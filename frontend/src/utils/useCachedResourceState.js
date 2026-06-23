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

export function useCachedResourceState(resource, {
    cacheKey,
    retainData = true,
    retainPreviousData = false,
} = {}) {
    const key = keyToString(cacheKey);
    const hasActiveKey = cacheKey !== null && cacheKey !== undefined;
    const lastDataRef = React.useRef({ key: '', data: undefined });
    const data = resource?.data;
    const hasIncomingData = data !== undefined && data !== null;

    if (hasActiveKey && hasIncomingData) {
        lastDataRef.current = { key, data };
    }

    const canRetainCurrentKey = lastDataRef.current.key === key;
    const canRetainPreviousKey = retainPreviousData && lastDataRef.current.key !== '';
    const retainedData = hasActiveKey && retainData && (canRetainCurrentKey || canRetainPreviousKey)
        ? lastDataRef.current.data
        : undefined;
    const displayData = hasIncomingData ? data : retainedData;
    const hasData = displayData !== undefined && displayData !== null;
    const isLoading = Boolean(resource?.isLoading);
    const isValidating = Boolean(resource?.isValidating);
    const isStale = hasData && !hasIncomingData && lastDataRef.current.key !== key;

    return {
        ...resource,
        displayData,
        hasData,
        isStale,
        isInitialLoading: !hasData && (isLoading || isValidating),
        isRefreshing: hasData && (isLoading || isValidating || isStale),
    };
}
