import axios from 'axios';
import qs from 'qs';

const API_BASE = '/api';

export async function fetcher(url, params) {
    const res = await axios.get(url, { params });
    return res.data;
}

export async function getTraitManhattanHits(traitName, { variant = 'hits', aliasId } = {}) {
    const res = await axios.get(`${API_BASE}/trait/manhattan/${encodeURIComponent(traitName)}`, {
        params: { variant, aliasId },
    });
    return res.data;
}

async function getVolcano(endpoint, fileId, { variant = 'hits', aliasId } = {}) {
    const res = await axios.get(`${API_BASE}/${endpoint}/${encodeURIComponent(fileId)}`, {
        params: { variant, aliasId },
    });
    return res.data;
}

export async function getBurdenVolcano(fileId, opts = {}) {
    return getVolcano('burden-volcano', fileId, opts);
}

export async function getPosteriorVolcano(fileId, opts = {}) {
    return getVolcano('posterior-volcano', fileId, opts);
}

export async function getDataFileText(path) {
    const res = await axios.get(`${API_BASE}/data/download`, {
        params: { path },
        responseType: 'text',
        transformResponse: [(data) => data],
    });
    return res.data;
}

export async function getHomeStats() {
    const res = await axios.get(`${API_BASE}/home/stats`);
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

export async function getTraitCorrelation(fileId, { targetIds = [], method = 'spearman' } = {}) {
    const res = await axios.get(`${API_BASE}/cross-trait/${encodeURIComponent(fileId)}/correlation`, {
        params: { targetIds, method },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    });
    return res.data;
}
