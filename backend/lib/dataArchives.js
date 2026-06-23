const fs = require('fs');
const path = require('path');
const { config } = require('./config');

const dataArchiveRoot = path.resolve(config.paths.dataArchiveDir);
const packageArchiveDirName = 'packages';

function normalizeArchiveRelPath(relPath = '') {
    return String(relPath || '')
        .split(/[\\/]/)
        .filter((segment) => segment && segment !== '.' && segment !== '..')
        .join('/');
}

function assertWithinArchiveRoot(fullPath) {
    const resolved = path.resolve(String(fullPath));
    return resolved === dataArchiveRoot || resolved.startsWith(`${dataArchiveRoot}${path.sep}`);
}

function getArchiveFileName(relPath = '') {
    const normalized = normalizeArchiveRelPath(relPath);
    const baseName = normalized
        ? normalized.split('/').pop()
        : path.basename(path.resolve(config.paths.dataDir)) || 'data';
    return `${baseName}.zip`;
}

function getArchivePath(relPath = '') {
    const normalized = normalizeArchiveRelPath(relPath);
    const parts = normalized.split('/').filter(Boolean);
    const fileName = parts.length > 0
        ? `${parts.pop()}.zip`
        : getArchiveFileName('');
    const fullPath = path.resolve(dataArchiveRoot, ...parts, fileName);

    if (!assertWithinArchiveRoot(fullPath)) {
        const err = new Error('Archive path is outside the configured archive root');
        err.status = 403;
        err.expose = true;
        throw err;
    }

    return fullPath;
}

function normalizePackageId(packageId = '') {
    const normalized = String(packageId || '').trim();
    if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
        const err = new Error('Invalid package id');
        err.status = 400;
        err.expose = true;
        throw err;
    }
    return normalized;
}

function getPackageArchivePath(packageId) {
    const normalized = normalizePackageId(packageId);
    const fullPath = path.resolve(dataArchiveRoot, packageArchiveDirName, `${normalized}.zip`);

    if (!assertWithinArchiveRoot(fullPath)) {
        const err = new Error('Package archive path is outside the configured archive root');
        err.status = 403;
        err.expose = true;
        throw err;
    }

    return fullPath;
}

async function statArchive(relPath = '') {
    const archivePath = getArchivePath(relPath);
    try {
        const stat = await fs.promises.stat(archivePath);
        if (!stat.isFile()) return { exists: false, path: archivePath };
        return {
            exists: true,
            path: archivePath,
            size: stat.size || 0,
            mtimeMs: stat.mtimeMs || null,
        };
    } catch (err) {
        if (err && err.code === 'ENOENT') return { exists: false, path: archivePath };
        throw err;
    }
}

async function statPackageArchive(packageId) {
    const archivePath = getPackageArchivePath(packageId);
    try {
        const stat = await fs.promises.stat(archivePath);
        if (!stat.isFile()) return { exists: false, path: archivePath };
        return {
            exists: true,
            path: archivePath,
            size: stat.size || 0,
            mtimeMs: stat.mtimeMs || null,
        };
    } catch (err) {
        if (err && err.code === 'ENOENT') return { exists: false, path: archivePath };
        throw err;
    }
}

function toArchiveResponse(relPath, archiveStat) {
    return {
        exists: Boolean(archiveStat?.exists),
        fileName: getArchiveFileName(relPath),
        size: archiveStat?.exists ? archiveStat.size || 0 : 0,
        mtime: archiveStat?.exists && archiveStat.mtimeMs
            ? new Date(archiveStat.mtimeMs).toISOString()
            : null,
    };
}

function toPackageArchiveResponse(packageId, archiveStat) {
    return {
        exists: Boolean(archiveStat?.exists),
        fileName: `${normalizePackageId(packageId)}.zip`,
        size: archiveStat?.exists ? archiveStat.size || 0 : 0,
        mtime: archiveStat?.exists && archiveStat.mtimeMs
            ? new Date(archiveStat.mtimeMs).toISOString()
            : null,
    };
}

module.exports = {
    dataArchiveRoot,
    getArchiveFileName,
    getArchivePath,
    getPackageArchivePath,
    normalizeArchiveRelPath,
    normalizePackageId,
    statPackageArchive,
    statArchive,
    toArchiveResponse,
    toPackageArchiveResponse,
};
