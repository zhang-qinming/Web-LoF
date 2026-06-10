const DEFAULT_MIN_SHARED_GENES = 100;

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function effectGeneKey(row) {
    const ensg = String(row?.ensg || '').trim();
    const gene = String(row?.gene || '').trim();
    return ensg || gene || null;
}

function buildEffectProfile(rows = []) {
    const values = new Map();

    rows.forEach((row) => {
        const geneKey = effectGeneKey(row);
        const value = toFiniteNumber(row?.post_mean);
        if (!geneKey || value == null || values.has(geneKey)) return;
        values.set(geneKey, value);
    });

    const sortedEntries = [...values.entries()]
        .map(([geneKey, value]) => ({ geneKey, value }))
        .sort((a, b) => a.value - b.value || a.geneKey.localeCompare(b.geneKey));

    return {
        values,
        sortedEntries,
        geneCount: values.size,
    };
}

function correlationFromMaps(mapA, mapB, genes, minSharedGenes) {
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;

    for (const geneKey of genes) {
        const x = mapA.get(geneKey);
        const y = mapB.get(geneKey);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        count += 1;
        sumX += x;
        sumY += y;
        sumXX += x * x;
        sumYY += y * y;
        sumXY += x * y;
    }

    if (count < minSharedGenes) return { correlation: null, sharedGenes: count };

    const covariance = sumXY - ((sumX * sumY) / count);
    const varianceX = sumXX - ((sumX * sumX) / count);
    const varianceY = sumYY - ((sumY * sumY) / count);
    const denominator = Math.sqrt(Math.max(0, varianceX) * Math.max(0, varianceY));

    if (!Number.isFinite(denominator) || denominator <= 0) {
        return { correlation: null, sharedGenes: count };
    }

    const correlation = Math.max(-1, Math.min(1, covariance / denominator));
    return {
        correlation: Number.isFinite(correlation) ? correlation : null,
        sharedGenes: count,
    };
}

function sharedGeneSet(profileA, profileB) {
    const smaller = profileA.values.size <= profileB.values.size ? profileA.values : profileB.values;
    const larger = smaller === profileA.values ? profileB.values : profileA.values;
    const shared = new Set();

    for (const geneKey of smaller.keys()) {
        if (larger.has(geneKey)) shared.add(geneKey);
    }
    return shared;
}

function rankSubset(sortedEntries, includedGenes) {
    const ranks = new Map();
    let includedPosition = 0;
    let index = 0;

    while (index < sortedEntries.length) {
        const value = sortedEntries[index].value;
        const tiedGenes = [];
        let nextIndex = index;

        while (nextIndex < sortedEntries.length && sortedEntries[nextIndex].value === value) {
            const geneKey = sortedEntries[nextIndex].geneKey;
            if (includedGenes.has(geneKey)) tiedGenes.push(geneKey);
            nextIndex += 1;
        }

        if (tiedGenes.length > 0) {
            const firstRank = includedPosition + 1;
            const lastRank = includedPosition + tiedGenes.length;
            const averageRank = (firstRank + lastRank) / 2;
            tiedGenes.forEach((geneKey) => ranks.set(geneKey, averageRank));
            includedPosition += tiedGenes.length;
        }

        index = nextIndex;
    }

    return ranks;
}

function correlateProfiles(profileA, profileB, method = 'spearman', minSharedGenes = DEFAULT_MIN_SHARED_GENES) {
    const shared = sharedGeneSet(profileA, profileB);
    if (shared.size < minSharedGenes) {
        return { correlation: null, sharedGenes: shared.size };
    }

    if (method === 'pearson') {
        return correlationFromMaps(profileA.values, profileB.values, shared, minSharedGenes);
    }

    const ranksA = rankSubset(profileA.sortedEntries, shared);
    const ranksB = rankSubset(profileB.sortedEntries, shared);
    return correlationFromMaps(ranksA, ranksB, shared, minSharedGenes);
}

function buildCorrelationMatrix(profiles, method = 'spearman', minSharedGenes = DEFAULT_MIN_SHARED_GENES) {
    const size = profiles.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const sharedGeneCounts = Array.from({ length: size }, () => Array(size).fill(0));
    let validPairCount = 0;
    let missingPairCount = 0;
    let minCorrelation = null;
    let maxCorrelation = null;
    let minShared = null;
    let maxShared = null;

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
        const diagonalCount = profiles[rowIndex].geneCount;
        matrix[rowIndex][rowIndex] = diagonalCount >= minSharedGenes ? 1 : null;
        sharedGeneCounts[rowIndex][rowIndex] = diagonalCount;

        for (let colIndex = rowIndex + 1; colIndex < size; colIndex += 1) {
            const result = correlateProfiles(
                profiles[rowIndex],
                profiles[colIndex],
                method,
                minSharedGenes,
            );

            matrix[rowIndex][colIndex] = result.correlation;
            matrix[colIndex][rowIndex] = result.correlation;
            sharedGeneCounts[rowIndex][colIndex] = result.sharedGenes;
            sharedGeneCounts[colIndex][rowIndex] = result.sharedGenes;

            minShared = minShared == null ? result.sharedGenes : Math.min(minShared, result.sharedGenes);
            maxShared = maxShared == null ? result.sharedGenes : Math.max(maxShared, result.sharedGenes);

            if (result.correlation == null) {
                missingPairCount += 1;
                continue;
            }

            validPairCount += 1;
            minCorrelation = minCorrelation == null
                ? result.correlation
                : Math.min(minCorrelation, result.correlation);
            maxCorrelation = maxCorrelation == null
                ? result.correlation
                : Math.max(maxCorrelation, result.correlation);
        }
    }

    return {
        matrix,
        sharedGeneCounts,
        summary: {
            validPairCount,
            missingPairCount,
            correlationRange: { min: minCorrelation, max: maxCorrelation },
            sharedGeneRange: { min: minShared, max: maxShared },
        },
    };
}

module.exports = {
    DEFAULT_MIN_SHARED_GENES,
    buildCorrelationMatrix,
    buildEffectProfile,
    correlateProfiles,
};
