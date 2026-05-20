import axios from 'axios';
import qs from 'qs';

const API_BASE = '/api';

export async function fetcher(url, params) {
    const res = await axios.get(url, { params });
    return res.data;
}

/**
 * 获取按性状筛选/分页/排序后的 GWAS 数据
 * filters: { CHR, BP_start, BP_end, P_min, P_max, rsID }
 */
export async function getFilteredGwasDataByTrait(traitName, { page, limit, sortBy, order } = {}, filters = {}) {
    try {
        const params = { page, limit, sortBy, order, ...filters };
        const res = await axios.get(`${API_BASE}/trait/filtergwas/${encodeURIComponent(traitName)}`, {
            params,
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'brackets' }),
        });
        return res.data;
    } catch (err) {
        console.error(`获取 Trait "${traitName}" 的过滤数据失败:`, err);
        return { data: [], totalCount: 0, page: 1, totalPages: 1 };
    }
}

export async function getTraitData(traitName) {
    try {
        const res = await axios.get(`${API_BASE}/trait/allgwas/${traitName}`);
        return res.data;
    } catch (err) {
        console.error(`获取 Trait "${traitName}" 失败:`, err);
        return { data: [] };
    }
}

export async function getTraitManhattanHits(traitName, { variant = 'hits' } = {}) {
    try {
        const res = await axios.get(`${API_BASE}/trait/manhattan/${encodeURIComponent(traitName)}`, {
            params: { variant },
        });
        return res.data;
    } catch (err) {
        console.error(`获取 Trait "${traitName}" Manhattan 数据失败:`, err);
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
                fullVariantPlaceholder: '',
            },
        };
    }
}

export async function getBurdenVolcano(fileId) {
    try {
        const res = await axios.get(`${API_BASE}/burden-volcano/${encodeURIComponent(fileId)}`);
        return res.data;
    } catch (err) {
        console.error(`获取 Trait "${fileId}" LoF Volcano 数据失败:`, err);
        return { data: [] };
    }
}
