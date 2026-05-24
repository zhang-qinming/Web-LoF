import axios from 'axios';
import qs from 'qs';

const API_BASE = '/api';

export async function fetcher(url, params) {
    const res = await axios.get(url, { params });
    return res.data;
}

export async function getFilteredGwasDataByTrait(traitName, { page, limit, sortBy, order } = {}, filters = {}) {
    try {
        const params = { page, limit, sortBy, order, ...filters };
        const res = await axios.get(`${API_BASE}/trait/filtergwas/${encodeURIComponent(traitName)}`, {
            params,
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'brackets' }),
        });
        return res.data;
    } catch (err) {
        console.error(`Failed to fetch filtered GWAS data for trait "${traitName}":`, err);
        return { data: [], totalCount: 0, page: 1, totalPages: 1 };
    }
}

export async function getTraitData(traitName) {
    try {
        const res = await axios.get(`${API_BASE}/trait/allgwas/${traitName}`);
        return res.data;
    } catch (err) {
        console.error(`Failed to fetch trait "${traitName}":`, err);
        return { data: [] };
    }
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
