const noAutoRevalidate = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshInterval: 0,
};

export const stableListSWRConfig = {
    ...noAutoRevalidate,
    keepPreviousData: true,
    shouldRetryOnError: false,
};

export const interactiveSearchSWRConfig = {
    ...noAutoRevalidate,
    keepPreviousData: true,
    dedupingInterval: 15 * 1000,
    shouldRetryOnError: false,
};

export const detailSummarySWRConfig = {
    ...noAutoRevalidate,
    keepPreviousData: false,
    shouldRetryOnError: false,
};

export const figureResourceSWRConfig = {
    ...noAutoRevalidate,
    keepPreviousData: false,
    shouldRetryOnError: false,
};

export const backgroundPrefetchSWRConfig = {
    ...noAutoRevalidate,
    keepPreviousData: true,
    dedupingInterval: 60 * 1000,
    shouldRetryOnError: false,
};

export const stableSWRConfig = detailSummarySWRConfig;
export const stableKeepPreviousSWRConfig = stableListSWRConfig;
