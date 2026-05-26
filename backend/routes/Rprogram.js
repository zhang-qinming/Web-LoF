const express = require('express');
const programModel = require('../models/Mprogram');
const { createFileStore } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { normalizeSafeBaseName, normalizeSafeBaseNameList } = require('../lib/request');
const { parseTsvStream } = require('../lib/tsv');
const { findVariantFile } = require('../lib/variantFiles');

const router = express.Router();

const programStore = createFileStore(config.paths.programDataDir);
const traitProgramGenePanelStore = createFileStore(config.paths.traitProgramGenePanelDir);
const burdenVolcanoStore = createFileStore(config.paths.burdenVolcanoDir);
const posteriorVolcanoStore = createFileStore(config.paths.posteriorVolcanoDir);
const VOLCANO_VARIANT_ALIASES = {
    full: ['full', 'fulltsv', 'all', 'allgene', 'allgenes', 'gene', 'genes'],
    hits: ['hits', 'hit', 'significant', 'sig'],
};
const PROGRAM_COLOR_LABELS = {
    other: 'Other',
    program_enriched: 'Program enriched',
    regulator_enriched: 'Regulator enriched',
    both_enriched: 'Both enriched',
};
const GRAPH_SIDE_TO_ROLE = {
    program_loading: 'program',
    regulator: 'regulator',
};
const GRAPH_ROLE_META = {
    program: {
        rowField: 'loadingGeneCount',
        edgeField: 'programScore',
        scoreLabel: 'program_score',
    },
    regulator: {
        rowField: 'regulatorGeneCount',
        edgeField: 'regulatorScore',
        scoreLabel: 'regulator_score',
    },
};

async function parseTsvFromStore(store, relativeName) {
    const fullPath = store.resolve(relativeName);
    if (!fullPath) return null;

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) return null;
    if (stat.size > config.data.maxTsvFileBytes) {
        const err = new Error('TSV file is too large');
        err.status = 413;
        err.expose = true;
        throw err;
    }

    const stream = await store.createReadStream(fullPath);
    return parseTsvStream(stream, { maxRows: config.data.maxTsvRows });
}

async function listAvailableTraitProgramGraphFiles() {
    const exists = await traitProgramGenePanelStore.exists(traitProgramGenePanelStore.rootPath);
    if (!exists) return [];

    const programFiles = new Set();
    const geneFiles = new Set();
    const entries = await traitProgramGenePanelStore.list(traitProgramGenePanelStore.rootPath);

    for (const entry of entries) {
        if (entry.type !== 'file') continue;

        const programMatch = entry.name.match(/^(.+)_programs\.tsv$/i);
        if (programMatch) {
            programFiles.add(programMatch[1]);
            continue;
        }

        const geneMatch = entry.name.match(/^(.+)_long\.tsv$/i);
        if (geneMatch) {
            geneFiles.add(geneMatch[1]);
        }
    }

    return [...programFiles]
        .filter((fileId) => geneFiles.has(fileId))
        .sort((a, b) => a.localeCompare(b));
}

async function getTsvVariant(store, fileIds, variant, suffix, { readRows = true } = {}) {
    const { fileName } = await findVariantFile(store, fileIds, variant, { suffix, aliases: VOLCANO_VARIANT_ALIASES });
    if (fileName) {
        if (!readRows) return { exists: true, data: [], fileName };

        const data = await parseTsvFromStore(store, fileName);
        return { exists: true, data: data || [], fileName };
    }

    return { exists: false, data: [], fileName: null };
}

function summarizeVolcanoRows(rows, effectField) {
    let positive = 0;
    let negative = 0;
    let annotatedProgram = 0;
    let annotatedGeneset = 0;

    for (const row of rows) {
        const effect = Number(row[effectField]);
        if (Number.isFinite(effect)) {
            if (effect >= 0) positive += 1;
            else negative += 1;
        }
        if (String(row.program || '').trim()) annotatedProgram += 1;
        if (String(row.geneset || '').trim()) annotatedGeneset += 1;
    }

    return {
        totalRows: rows.length,
        positive,
        negative,
        annotatedProgram,
        annotatedGeneset,
    };
}

function createVolcanoRoute({ store, volcanoType, effectField }) {
    return asyncRoute(async (req, res) => {
        const safeFileId = normalizeSafeBaseName(req.params.fileId);
        if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

        const variant = req.query.variant === 'full' ? 'full' : 'hits';
        const lookupIds = [safeFileId, ...normalizeSafeBaseNameList(req.query.aliasId)];
        const current = await getTsvVariant(store, lookupIds, variant, '.tsv');
        const fallbackVariant = variant === 'full' ? 'hits' : 'full';
        const fallback = await getTsvVariant(store, lookupIds, fallbackVariant, '.tsv');
        const hitsResult = variant === 'hits'
            ? (current.exists ? current : (fallbackVariant === 'hits' ? fallback : await getTsvVariant(store, lookupIds, 'hits', '.tsv', { readRows: false })))
            : fallback || await getTsvVariant(store, lookupIds, 'hits', '.tsv');
        const fullResult = variant === 'full'
            ? (current.exists ? current : (fallbackVariant === 'full' ? fallback : await getTsvVariant(store, lookupIds, 'full', '.tsv', { readRows: false })))
            : (fallbackVariant === 'full' ? (fallback.exists ? fallback : await getTsvVariant(store, lookupIds, 'full', '.tsv', { readRows: false })) : await getTsvVariant(store, lookupIds, 'full', '.tsv', { readRows: false }));
        const effective = current.exists ? current : (fallback || current);
        const usingFallback = !current.exists && Boolean(fallback?.exists);
        const resolvedVariant = current.exists ? variant : (usingFallback ? fallbackVariant : variant);

        if (!effective.exists) return res.status(404).json({ error: 'Not found' });

        res.json({
            fileId: safeFileId,
            volcanoType,
            effectField,
            variant,
            requestedVariant: variant,
            resolvedVariant,
            fallbackUsed: usingFallback,
            fileName: effective.fileName,
            availableVariants: {
                hits: hitsResult.exists,
                full: fullResult.exists,
            },
            hasData: effective.data.length > 0,
            data: effective.data,
            summary: summarizeVolcanoRows(effective.data, effectField),
        });
    });
}

function toNullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeText(value, fallback = '') {
    const text = String(value || '').trim();
    return text || fallback;
}

function deriveSelectedSide(program) {
    if (program.selectedByProgram && program.selectedByRegulator) return 'both';
    if (program.selectedByProgram) return 'program';
    if (program.selectedByRegulator) return 'regulator';
    return 'none';
}

function deriveEdgeDirection(score) {
    if (!Number.isFinite(score) || score === 0) return 'neutral';
    return score > 0 ? 'arrow' : 'flat';
}

function buildProgramNode(row) {
    const program = normalizeText(row.Program);
    const programScore = toNullableNumber(row.program_score);
    const regulatorScore = toNullableNumber(row.regulator_score);
    const selectedByProgram = toBoolean(row.selected_by_program);
    const selectedByRegulator = toBoolean(row.selected_by_regulator);
    const hasOverlap = row.has_overlap == null ? true : toBoolean(row.has_overlap);
    const loadingGeneCount = toNullableNumber(row.loading_gene_count) ?? 0;
    const regulatorGeneCount = toNullableNumber(row.regulator_gene_count) ?? 0;

    return {
        id: program,
        program,
        traitId: normalizeText(row.trait_id),
        label: normalizeText(row.program_label, program),
        annotation: normalizeText(row.program_annotation),
        programTraitSign: normalizeText(row.program_trait_sign),
        colorKey: PROGRAM_COLOR_LABELS[row.color] ? row.color : 'other',
        colorLabel: PROGRAM_COLOR_LABELS[row.color] || PROGRAM_COLOR_LABELS.other,
        programScore,
        regulatorScore,
        programSig: toBoolean(row.program_sig),
        regulatorSig: toBoolean(row.regulator_sig),
        selectedByProgram,
        selectedByRegulator,
        selectedSide: deriveSelectedSide({ selectedByProgram, selectedByRegulator }),
        loadingGeneCount,
        regulatorGeneCount,
        loadingVisibleCount: 0,
        regulatorVisibleCount: 0,
        loadingTotalCount: 0,
        regulatorTotalCount: 0,
        hasOverlap,
        emptyReason: normalizeText(row.empty_reason),
        collapsed: !hasOverlap || (loadingGeneCount + regulatorGeneCount) === 0,
        panelRow: toNullableNumber(row.panel_row),
        yCenter: toNullableNumber(row.y_center),
        priorityTier: toNullableNumber(row.priority_tier),
        priorityScore: toNullableNumber(row.priority_score),
        edgeMeta: {
            program: {
                direction: deriveEdgeDirection(programScore),
                score: programScore,
                scoreAbs: Math.abs(programScore || 0),
            },
            regulator: {
                direction: deriveEdgeDirection(regulatorScore),
                score: regulatorScore,
                scoreAbs: Math.abs(regulatorScore || 0),
            },
        },
        genes: {
            program: [],
            regulator: [],
        },
    };
}

function buildGeneNode(row) {
    const role = GRAPH_SIDE_TO_ROLE[row.side] || null;
    if (!role) return null;

    const postMean = toNullableNumber(row.post_mean);
    const absGamma = toNullableNumber(row.abs_gamma);
    const membershipScore = toNullableNumber(row.membership_score);
    const displayRank = toNullableNumber(row.display_rank);
    const displayColumnRank = toNullableNumber(row.display_column_rank);

    return {
        id: [normalizeText(row.Program), role, normalizeText(row.ensg), normalizeText(row.gene)].join(':'),
        program: normalizeText(row.Program),
        traitId: normalizeText(row.trait_id),
        role,
        side: normalizeText(row.side),
        gene: normalizeText(row.gene),
        ensg: normalizeText(row.ensg),
        postMean,
        absGamma,
        gammaSign: normalizeText(row.gamma_sign, 'unknown'),
        membershipScore,
        rankWithinSide: toNullableNumber(row.rank_within_side),
        programTraitSign: normalizeText(row.program_trait_sign),
        regulatorProgramSign: normalizeText(row.regulator_program_sign),
        predictedSign: normalizeText(row.predicted_sign),
        postMeanSign: normalizeText(row.post_mean_sign),
        isConcordant: row.is_concordant == null ? false : toBoolean(row.is_concordant),
        isDiscordant: toBoolean(row.is_discordant),
        displayBucket: normalizeText(row.display_bucket),
        displayBucketLabel: normalizeText(row.display_bucket_label),
        displayColumn: normalizeText(row.display_column),
        displayColumnRank: Number.isFinite(displayColumnRank) ? displayColumnRank : Number.MAX_SAFE_INTEGER,
        programLabel: normalizeText(row.program_label),
        geneLabel: normalizeText(row.gene_label, normalizeText(row.gene)),
        displayRank: Number.isFinite(displayRank) ? displayRank : Number.MAX_SAFE_INTEGER,
        x: toNullableNumber(row.x),
        y: toNullableNumber(row.y),
        panelRow: toNullableNumber(row.panel_row),
        yGlobal: toNullableNumber(row.y_global),
        hasOverlap: row.has_overlap == null ? true : toBoolean(row.has_overlap),
        emptyReason: normalizeText(row.empty_reason),
        highlightKey: normalizeText(row.ensg, normalizeText(row.gene)),
    };
}

function sortProgramsForRole(programs, role) {
    const scoreField = GRAPH_ROLE_META[role].edgeField;

    return [...programs].sort((a, b) => {
        const collapsedDelta = Number(a.collapsed) - Number(b.collapsed);
        if (collapsedDelta !== 0) return collapsedDelta;

        const aScore = Math.abs(a[scoreField] || 0);
        const bScore = Math.abs(b[scoreField] || 0);
        if (aScore !== bScore) return bScore - aScore;

        const aRow = a.panelRow ?? Number.MAX_SAFE_INTEGER;
        const bRow = b.panelRow ?? Number.MAX_SAFE_INTEGER;
        if (aRow !== bRow) return aRow - bRow;

        return a.program.localeCompare(b.program, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function buildGraphPayload(fileId, programRows, geneRows) {
    const programMap = new Map();

    for (const row of programRows) {
        const node = buildProgramNode(row);
        if (!node.program) continue;
        programMap.set(node.program, node);
    }

    for (const row of geneRows) {
        const gene = buildGeneNode(row);
        if (!gene) continue;

        const program = programMap.get(gene.program) || buildProgramNode({
            Program: gene.program,
            trait_id: gene.traitId,
            color: 'other',
            has_overlap: gene.hasOverlap ? 'TRUE' : 'FALSE',
            empty_reason: gene.emptyReason,
        });

        if (!programMap.has(gene.program)) {
            programMap.set(gene.program, program);
        }

        program.genes[gene.role].push(gene);
    }

    const programs = [...programMap.values()].map((program) => {
        const loadingGenes = [...program.genes.program].sort((a, b) => a.displayRank - b.displayRank);
        const regulatorGenes = [...program.genes.regulator].sort((a, b) => a.displayRank - b.displayRank);

        return {
            ...program,
            loadingTotalCount: loadingGenes.length,
            regulatorTotalCount: regulatorGenes.length,
            loadingVisibleCount: loadingGenes.filter((gene) => gene.hasOverlap).length,
            regulatorVisibleCount: regulatorGenes.filter((gene) => gene.hasOverlap).length,
            collapsed: program.collapsed || (loadingGenes.length + regulatorGenes.length) === 0,
            genes: {
                program: loadingGenes,
                regulator: regulatorGenes,
            },
        };
    });

    const leftPrograms = sortProgramsForRole(
        programs.filter((program) => program.selectedByProgram),
        'program',
    );
    const rightPrograms = sortProgramsForRole(
        programs.filter((program) => program.selectedByRegulator),
        'regulator',
    );
    const hiddenPrograms = sortProgramsForRole(
        programs.filter((program) => !program.selectedByProgram && !program.selectedByRegulator),
        'program',
    );
    const traitId = normalizeText(
        programs.find((program) => program.traitId)?.traitId || programRows[0]?.trait_id || geneRows[0]?.trait_id,
        fileId,
    );

    return {
        fileId,
        traitId,
        traitNode: {
            id: traitId,
            label: traitId,
        },
        counts: {
            totalPrograms: programs.length,
            leftPrograms: leftPrograms.length,
            rightPrograms: rightPrograms.length,
            hiddenPrograms: hiddenPrograms.length,
            totalGenes: geneRows.length,
        },
        programs,
        layout: {
            leftPrograms,
            rightPrograms,
            hiddenPrograms,
        },
        meta: {
            sideRoles: GRAPH_SIDE_TO_ROLE,
            colorLabels: PROGRAM_COLOR_LABELS,
        },
    };
}

router.get('/api/programs/info', asyncRoute(async (req, res) => {
    const map = await programModel.getProgramInfo();
    res.json(map);
}));

router.get('/api/programs/list', asyncRoute(async (req, res) => {
    const exists = await programStore.exists(programStore.rootPath);
    if (!exists) return res.json({ files: [] });

    const files = (await programStore.list(programStore.rootPath))
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.tsv'))
        .map((entry) => entry.name.replace(/\.tsv$/i, ''));

    res.json({ files });
}));

router.get('/api/programs/graph-list', asyncRoute(async (req, res) => {
    const files = await listAvailableTraitProgramGraphFiles();
    res.json({ files });
}));

router.get('/api/programs/:fileId', asyncRoute(async (req, res) => {
    const safeFileId = normalizeSafeBaseName(req.params.fileId);
    if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

    const data = await parseTsvFromStore(programStore, `${safeFileId}.tsv`);
    if (!data) return res.status(404).json({ error: 'Not found' });

    res.json({ data });
}));

router.get('/api/programs/:fileId/graph', asyncRoute(async (req, res) => {
    const safeFileId = normalizeSafeBaseName(req.params.fileId);
    if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

    const programRows = await parseTsvFromStore(traitProgramGenePanelStore, `${safeFileId}_programs.tsv`);
    const geneRows = await parseTsvFromStore(traitProgramGenePanelStore, `${safeFileId}_long.tsv`);

    if (!programRows || !geneRows) {
        return res.status(404).json({ error: 'Graph data not found' });
    }

    res.json(buildGraphPayload(safeFileId, programRows, geneRows));
}));

router.get('/api/burden-volcano/:fileId', createVolcanoRoute({
    store: burdenVolcanoStore,
    volcanoType: 'burden',
    effectField: 'beta',
}));

router.get('/api/posterior-volcano/:fileId', createVolcanoRoute({
    store: posteriorVolcanoStore,
    volcanoType: 'posterior',
    effectField: 'post_mean',
}));

module.exports = router;
