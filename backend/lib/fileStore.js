const fs = require('fs');
const path = require('path');
const SftpClient = require('ssh2-sftp-client');

function normalizeMode(value) {
    return String(value || 'local').trim().toLowerCase() === 'sftp' ? 'sftp' : 'local';
}

function normalizeTimestamp(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num < 1e12 ? num * 1000 : num;
}

function isMissingError(err) {
    return Boolean(
        err
        && (
            err.code === 'ENOENT'
            || err.code === 2
            || /no such file/i.test(err.message || '')
            || /does not exist/i.test(err.message || '')
        )
    );
}

function buildHttpError(status, message) {
    const err = new Error(message);
    err.status = status;
    if (status >= 400 && status < 500) err.expose = true;
    return err;
}

function readPrivateKeyFromEnv() {
    if (process.env.SFTP_PRIVATE_KEY) {
        return process.env.SFTP_PRIVATE_KEY.replace(/\\n/g, '\n');
    }

    if (process.env.SFTP_PRIVATE_KEY_PATH) {
        return fs.readFileSync(process.env.SFTP_PRIVATE_KEY_PATH, 'utf8');
    }

    return null;
}

function buildSftpConfig() {
    const host = process.env.SFTP_HOST;
    const username = process.env.SFTP_USERNAME || process.env.SFTP_USER;

    if (!host || !username) {
        throw new Error('SFTP_HOST and SFTP_USERNAME are required when FILE_ACCESS_MODE=sftp');
    }

    const config = {
        host,
        port: parseInt(process.env.SFTP_PORT, 10) || 22,
        username,
        readyTimeout: parseInt(process.env.SFTP_READY_TIMEOUT, 10) || 20000,
    };

    if (process.env.SFTP_PASSWORD) {
        config.password = process.env.SFTP_PASSWORD;
    }

    const privateKey = readPrivateKeyFromEnv();
    if (privateKey) {
        config.privateKey = privateKey;
    }

    if (process.env.SFTP_PASSPHRASE) {
        config.passphrase = process.env.SFTP_PASSPHRASE;
    }

    const keepaliveInterval = parseInt(process.env.SFTP_KEEPALIVE_INTERVAL, 10);
    if (Number.isFinite(keepaliveInterval) && keepaliveInterval > 0) {
        config.keepaliveInterval = keepaliveInterval;
    }

    const keepaliveCountMax = parseInt(process.env.SFTP_KEEPALIVE_COUNT_MAX, 10);
    if (Number.isFinite(keepaliveCountMax) && keepaliveCountMax > 0) {
        config.keepaliveCountMax = keepaliveCountMax;
    }

    return config;
}

async function endSftpClientQuietly(client) {
    try {
        await client.end();
    } catch (err) {
        // Ignore shutdown errors during cleanup.
    }
}

async function withSftpClient(callback) {
    const client = new SftpClient('gwas-data-store');
    await client.connect(buildSftpConfig());
    try {
        return await callback(client);
    } finally {
        await endSftpClientQuietly(client);
    }
}

async function createManagedSftpReadStream(remotePath) {
    const client = new SftpClient('gwas-data-stream');
    await client.connect(buildSftpConfig());

    try {
        const stream = client.createReadStream(remotePath);
        let cleanedUp = false;

        const cleanup = async () => {
            if (cleanedUp) return;
            cleanedUp = true;
            await endSftpClientQuietly(client);
        };

        stream.on('close', () => { void cleanup(); });
        stream.on('end', () => { void cleanup(); });
        stream.on('error', () => { void cleanup(); });

        return stream;
    } catch (err) {
        await endSftpClientQuietly(client);
        throw err;
    }
}

class BaseFileStore {
    constructor(rootPath, pathImpl) {
        if (!rootPath) {
            throw new Error('A root path is required to create a file store');
        }

        this.pathImpl = pathImpl;
        this.pathSep = pathImpl.sep;
        this.rootPath = pathImpl.resolve(String(rootPath));
    }

    sanitizeSubPath(subPath = '') {
        return String(subPath || '')
            .split(/[\\/]/)
            .filter((segment) => segment && segment !== '.' && segment !== '..')
            .join(this.pathSep);
    }

    resolve(subPath = '') {
        const clean = this.sanitizeSubPath(subPath);
        const resolved = this.pathImpl.resolve(this.rootPath, clean);
        return this.isWithinRoot(resolved) ? resolved : null;
    }

    normalizeForCompare(fullPath) {
        const normalized = this.pathImpl.resolve(String(fullPath));
        if (this.pathSep === '\\') {
            return normalized.toLowerCase();
        }
        return normalized;
    }

    isWithinRoot(fullPath) {
        const normalized = this.normalizeForCompare(fullPath);
        const root = this.normalizeForCompare(this.rootPath);
        return normalized === root || normalized.startsWith(`${root}${this.pathSep}`);
    }

    assertAllowed(fullPath) {
        if (!this.isWithinRoot(fullPath)) {
            throw buildHttpError(403, 'Forbidden');
        }
        return this.pathImpl.resolve(String(fullPath));
    }

    basename(fullPath) {
        return this.pathImpl.basename(this.assertAllowed(fullPath));
    }
}

class LocalFileStore extends BaseFileStore {
    constructor(rootPath) {
        super(rootPath, path);
        this.mode = 'local';
    }

    async exists(fullPath) {
        const target = this.assertAllowed(fullPath);
        try {
            await fs.promises.access(target);
            return true;
        } catch (err) {
            if (isMissingError(err)) return false;
            throw err;
        }
    }

    async stat(fullPath) {
        const target = this.assertAllowed(fullPath);
        try {
            const stat = await fs.promises.stat(target);
            return {
                isDirectory: stat.isDirectory(),
                isFile: stat.isFile(),
                size: stat.size || 0,
                mtimeMs: stat.mtimeMs || null,
            };
        } catch (err) {
            if (isMissingError(err)) return null;
            throw err;
        }
    }

    async list(fullPath) {
        const target = this.assertAllowed(fullPath);
        const entries = await fs.promises.readdir(target, { withFileTypes: true });

        return Promise.all(entries
            .filter((entry) => entry.isDirectory() || entry.isFile())
            .map(async (entry) => {
                const childPath = path.join(target, entry.name);
                let stat = null;
                try {
                    stat = await fs.promises.stat(childPath);
                } catch (err) {
                    stat = null;
                }

                return {
                    name: entry.name,
                    type: entry.isDirectory() ? 'dir' : 'file',
                    size: stat?.size || 0,
                    mtimeMs: stat?.mtimeMs || null,
                };
            }));
    }

    async readFile(fullPath, encoding = 'utf8') {
        const target = this.assertAllowed(fullPath);
        return fs.promises.readFile(target, encoding);
    }

    async createReadStream(fullPath) {
        const target = this.assertAllowed(fullPath);
        return fs.createReadStream(target);
    }

    async appendToArchive(archive, fullPath, entryName) {
        const target = this.assertAllowed(fullPath);
        const stat = await this.stat(target);
        if (!stat) throw buildHttpError(404, 'Not found');

        if (stat.isDirectory) {
            archive.directory(target, entryName);
            return;
        }

        archive.file(target, { name: entryName });
    }
}

class SftpFileStore extends BaseFileStore {
    constructor(rootPath) {
        super(rootPath, path.posix);
        this.mode = 'sftp';
    }

    async exists(fullPath) {
        const target = this.assertAllowed(fullPath);
        return withSftpClient((client) => client.exists(target).then(Boolean));
    }

    async stat(fullPath) {
        const target = this.assertAllowed(fullPath);
        try {
            const stat = await withSftpClient((client) => client.stat(target));
            return {
                isDirectory: Boolean(stat.isDirectory),
                isFile: Boolean(stat.isFile),
                size: Number(stat.size) || 0,
                mtimeMs: normalizeTimestamp(stat.modifyTime),
            };
        } catch (err) {
            if (isMissingError(err)) return null;
            throw err;
        }
    }

    async list(fullPath) {
        const target = this.assertAllowed(fullPath);
        const entries = await withSftpClient((client) => client.list(target));

        return entries
            .filter((entry) => entry.type === 'd' || entry.type === '-')
            .map((entry) => ({
                name: entry.name,
                type: entry.type === 'd' ? 'dir' : 'file',
                size: Number(entry.size) || 0,
                mtimeMs: normalizeTimestamp(entry.modifyTime),
            }));
    }

    async readFile(fullPath, encoding = 'utf8') {
        const target = this.assertAllowed(fullPath);
        const data = await withSftpClient((client) => client.get(target));

        if (Buffer.isBuffer(data)) {
            return encoding ? data.toString(encoding) : data;
        }

        if (typeof data === 'string') {
            return data;
        }

        return Buffer.from(data || '').toString(encoding);
    }

    async createReadStream(fullPath) {
        const target = this.assertAllowed(fullPath);
        return createManagedSftpReadStream(target);
    }

    async appendToArchive(archive, fullPath, entryName) {
        const target = this.assertAllowed(fullPath);
        const stat = await this.stat(target);
        if (!stat) throw buildHttpError(404, 'Not found');

        if (stat.isDirectory) {
            const entries = await this.list(target);
            for (const entry of entries) {
                const childPath = this.pathImpl.join(target, entry.name);
                const childName = entryName ? `${entryName}/${entry.name}` : entry.name;
                await this.appendToArchive(archive, childPath, childName);
            }
            return;
        }

        const stream = await this.createReadStream(target);
        archive.append(stream, { name: entryName });
    }
}

function createFileStore(rootPath) {
    return normalizeMode(process.env.FILE_ACCESS_MODE) === 'sftp'
        ? new SftpFileStore(rootPath)
        : new LocalFileStore(rootPath);
}

module.exports = {
    buildHttpError,
    createFileStore,
};
