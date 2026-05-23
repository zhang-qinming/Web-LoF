const fs = require('fs');
const path = require('path');

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

class LocalFileStore {
    constructor(rootPath) {
        if (!rootPath) {
            throw new Error('A root path is required to create a file store');
        }

        this.pathImpl = path;
        this.pathSep = path.sep;
        this.mode = 'local';
        this.rootPath = path.resolve(String(rootPath));
    }

    sanitizeSubPath(subPath = '') {
        return String(subPath || '')
            .split(/[\\/]/)
            .filter((segment) => segment && segment !== '.' && segment !== '..')
            .join(this.pathSep);
    }

    normalizeForCompare(fullPath) {
        return path.resolve(String(fullPath));
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
        return path.resolve(String(fullPath));
    }

    resolve(subPath = '') {
        const clean = this.sanitizeSubPath(subPath);
        const resolved = path.resolve(this.rootPath, clean);
        return this.isWithinRoot(resolved) ? resolved : null;
    }

    basename(fullPath) {
        return path.basename(this.assertAllowed(fullPath));
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

function createFileStore(rootPath) {
    return new LocalFileStore(rootPath);
}

module.exports = {
    buildHttpError,
    createFileStore,
};
