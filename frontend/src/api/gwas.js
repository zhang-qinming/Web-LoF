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
