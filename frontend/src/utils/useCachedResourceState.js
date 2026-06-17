import React from 'react';

function keyToString(key) {
    if (key == null) return '';
    if (typeof key === 'string') return key;
    try {
        return JSON.stringify(key);
    } catch {
        return String(key);
    }
}

export function useCachedResourceState(resource, { cacheKey, retainData = true } = {}) {
    const key = keyToString(cacheKey);
    const lastDataRef = React.useRef({ key: '', data: undefined });
    const data = resource?.data;
    const hasIncomingData = data !== undefined && data !== null;

    if (hasIncomingData) {
        lastDataRef.current = { key, data };
    }

    const retainedData = retainData && lastDataRef.current.key === key
        ? lastDataRef.current.data
        : undefined;
    const displayData = hasIncomingData ? data : retainedData;
    const hasData = displayData !== undefined && displayData !== null;
    const isLoading = Boolean(resource?.isLoading);
    const isValidating = Boolean(resource?.isValidating);

    return {
        ...resource,
        displayData,
        hasData,
        isInitialLoading: !hasData && (isLoading || isValidating),
        isRefreshing: hasData && isValidating,
    };
}
