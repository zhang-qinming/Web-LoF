const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const metaModel = require('../models/Mmeta');
const { config } = require('../lib/config');
const { createFileStore } = require('../lib/fileStore');
const { asyncRoute } = require('../lib/http');
const { normalizeIdentifier, parsePageOptions } = require('../lib/request');

const regulationStore = createFileStore(config.paths.regulationDataDir);
const dataStore = createFileStore(config.paths.dataDir);
const HOME_STATS_TTL_MS = 5 * 60 * 1000;
let homeStatsCache = null;
let homeStatsCachedAt = 0;
let homeStatsPromise = null;

function countDistinctPrograms(files) {
    const programIds = new Set();
    files
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.txt'))
        .forEach((entry) => {
            const exact = String(entry.name || '').match(/K(\d+)_program(\d+)_perturb_effects\.txt$/i);
            if (exact) {
                programIds.add(exact[2]);
                return;
            }
            const fallback = String(entry.name || '').match(/program(\d+)/i);
            if (fallback) programIds.add(fallback[1]);
        });
    return programIds.size;
}

async function countDataOutputs(rootPath) {
    try {
        const rootStat = await fs.promises.stat(rootPath);
        if (!rootStat.isDirectory()) return 0;
    } catch (error) {
        if (error?.code === 'ENOENT') return 0;
        throw error;
    }

    let total = 0;
    const pending = [rootPath];

    while (pending.length > 0) {
        const currentPath = pending.pop();
        let entries = [];

        try {
            entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        } catch (error) {
            if (error?.code === 'ENOENT') continue;
            throw error;
        }

        for (const entry of entries) {
            if (entry.isFile()) {
                total += 1;
                continue;
            }

            if (entry.isDirectory()) {
                pending.push(path.join(currentPath, entry.name));
            }
        }
    }

    return total;
}

async function buildHomeStats() {
    const [metaSummary, programFiles, dataOutputs] = await Promise.all([
        metaModel.getHomeSummary(),
        (async () => {
            const exists = await regulationStore.exists(regulationStore.rootPath);
            if (!exists) return 0;
            const files = await regulationStore.list(regulationStore.rootPath);
            return countDistinctPrograms(files);
        })(),
        countDataOutputs(dataStore.rootPath),
    ]);

    return {
        ...metaSummary,
        programs: programFiles,
        dataOutputs,
    };
}

async function getHomeStats() {
    const isFresh = homeStatsCache && (Date.now() - homeStatsCachedAt) < HOME_STATS_TTL_MS;
    if (isFresh) return homeStatsCache;

    if (!homeStatsPromise) {
        homeStatsPromise = buildHomeStats()
            .then((stats) => {
                homeStatsCache = stats;
                homeStatsCachedAt = Date.now();
                return stats;
            })
            .finally(() => {
                homeStatsPromise = null;
            });
    }

    return homeStatsPromise;
}

router.get('/api/browse', asyncRoute(async (req, res) => {
    const result = await metaModel.getTraits({
        ...parsePageOptions(req.query, {
        defaultLimit: 20,
        defaultSortBy: 'trait_name',
        }),
        search: req.query.search,
    });
    res.json(result);
}));

router.get('/api/meta/:fileId', asyncRoute(async (req, res) => {
    const fileId = normalizeIdentifier(req.params.fileId, 255);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await metaModel.getTraitMeta(fileId);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    res.json(meta);
}));

router.get('/api/home/stats', asyncRoute(async (req, res) => {
    res.json(await getHomeStats());
}));

module.exports = router;
