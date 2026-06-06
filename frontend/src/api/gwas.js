import axios from 'axios';
import qs from 'qs';

const API_BASE = '/api';

export async function fetcher(url, params) {
    const res = await axios.get(url, { params });
    return res.data;
}

export async function getTraitManhattanHits(traitName, { variant = 'hits', aliasId } = {}) {
    try {
        const res = await axios.get(`${API_BASE}/trait/manhattan/${encodeURIComponent(traitName)}`, {
            params: { variant, aliasId },
        });
        return res.data;
    } catch (err) {
        console.error(`Failed to fetch Manhattan data for trait "${traitName}":`, err);
        return {
            fileId: traitName,
            variant,
            requestedVariant: variant,
            resolvedVariant: variant,
            fallbackUsed: false,
            availableVariants: { hits: false, full: false },
            hasData: false,
            data: [],
            summary: {
                totalRows: 0,
                withProgram: 0,
                withGeneset: 0,
                withoutProgram: 0,
                withoutGeneset: 0,
                distanceBuckets: { in_gene: 0, near: 0, moderate: 0, distal: 0, unknown: 0 },
                topPrograms: [],
                topGenesets: [],
            },
            notes: {
                distance_to_gene: '',
            },
        };
    }
}

function emptyVolcanoResponse(fileId, variant, volcanoType, effectField) {
    return {
        fileId,
        volcanoType,
        effectField,
        variant,
        requestedVariant: variant,
        resolvedVariant: variant,
        fallbackUsed: false,
        availableVariants: { hits: false, full: false },
        hasData: false,
        data: [],
        summary: {
            totalRows: 0,
            positive: 0,
            negative: 0,
            annotatedProgram: 0,
            annotatedGeneset: 0,
        },
    };
}

async function getVolcano(endpoint, fileId, { variant = 'hits', aliasId } = {}, { volcanoType, effectField }) {
    try {
        const res = await axios.get(`${API_BASE}/${endpoint}/${encodeURIComponent(fileId)}`, {
            params: { variant, aliasId },
        });
        return res.data;
    } catch (err) {
        console.error(`Failed to fetch ${volcanoType} volcano data for trait "${fileId}":`, err);
        return emptyVolcanoResponse(fileId, variant, volcanoType, effectField);
    }
}

export async function getBurdenVolcano(fileId, opts = {}) {
    return getVolcano('burden-volcano', fileId, opts, {
        volcanoType: 'burden',
        effectField: 'beta',
    });
}

export async function getPosteriorVolcano(fileId, opts = {}) {
    return getVolcano('posterior-volcano', fileId, opts, {
        volcanoType: 'posterior',
        effectField: 'post_mean',
    });
}

export async function getDataFileText(path) {
    const res = await axios.get(`${API_BASE}/data/download`, {
        params: { path },
        responseType: 'text',
        transformResponse: [(data) => data],
    });
    return res.data;
}

export async function getGenes({ page = 1, limit = 25, sortBy = 'totalTraits', order = 'desc', search = '' } = {}) {
    const res = await axios.get(`${API_BASE}/genes`, {
        params: { page, limit, sortBy, order, search },
    });
    return res.data;
}

export async function searchGenes(query, { limit = 20 } = {}) {
    const res = await axios.get(`${API_BASE}/genes/search`, {
        params: { q: query, limit },
    });
    return res.data;
}

export async function getRecommendedGenes({ limit = 12 } = {}) {
    const res = await axios.get(`${API_BASE}/genes/recommended`, {
        params: { limit },
    });
    return res.data;
}

export async function getGenePrograms(geneId, {
    page = 1,
    limit = 50,
    sortBy = 'absGamma',
    order = 'desc',
} = {}) {
    const res = await axios.get(`${API_BASE}/genes/${encodeURIComponent(geneId)}/programs`, {
        params: { page, limit, sortBy, order },
    });
    return res.data;
}

export async function getProgramTraits(programId) {
    const res = await axios.get(`${API_BASE}/programs/${encodeURIComponent(programId)}/traits`);
    return res.data;
}

export async function getProgramGenes(programId) {
    const res = await axios.get(`${API_BASE}/programs/${encodeURIComponent(programId)}/genes`);
    return res.data;
}

export async function getCrossTraitStatus(fileId) {
    const res = await axios.get(`${API_BASE}/cross-trait/${encodeURIComponent(fileId)}/status`);
    return res.data;
}

export async function getCrossTraitTargets(fileId) {
    const res = await axios.get(`${API_BASE}/cross-trait/${encodeURIComponent(fileId)}/targets`);
    return res.data;
}

export async function searchCrossTraits(query, { limit = 12, excludeId = [] } = {}) {
    const res = await axios.get(`${API_BASE}/cross-trait/search`, {
        params: { q: query, limit, excludeId },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    });
    return res.data;
}

export async function getCrossTraitMatrix(fileId, { targetIds = [], topGenes = 50 } = {}) {
    const res = await axios.get(`${API_BASE}/cross-trait/${encodeURIComponent(fileId)}/matrix`, {
        params: { targetIds, topGenes },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    });
    return res.data;
}
