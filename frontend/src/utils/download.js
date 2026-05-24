const DOWNLOAD_FRAME_ID = 'app-download-frame';
const DOWNLOAD_FRAME_NAME = 'app-download-frame';

function ensureDownloadFrame() {
    let frame = document.getElementById(DOWNLOAD_FRAME_ID);
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = DOWNLOAD_FRAME_ID;
        frame.name = DOWNLOAD_FRAME_NAME;
        frame.style.display = 'none';
        document.body.appendChild(frame);
    }
    return frame;
}

export function buildApiUrl(path, params = {}) {
    const base = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
    const url = new URL(base, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
        if (value == null) return;
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item != null) url.searchParams.append(key, String(item));
            });
            return;
        }
        url.searchParams.set(key, String(value));
    });

    return `${url.pathname}${url.search}`;
}

export function triggerNativeDownload(url) {
    const frame = ensureDownloadFrame();
    frame.src = url;
}

export function submitDownloadForm(action, fields = {}) {
    const frame = ensureDownloadFrame();
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.target = frame.name;
    form.style.display = 'none';

    Object.entries(fields).forEach(([key, value]) => {
        if (value == null) return;
        const values = Array.isArray(value) ? value : [value];
        values.forEach((item) => {
            if (item == null) return;
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(item);
            form.appendChild(input);
        });
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

export function getZipName(path, fallback = 'data') {
    return `${String(path || '').split('/').filter(Boolean).pop() || fallback}.zip`;
}

export async function triggerDataDownload(path) {
    const response = await fetch(buildApiUrl('/data/download-info', { path }));
    if (!response.ok) {
        let message = 'Download failed';
        try {
            const payload = await response.json();
            if (payload?.error) message = payload.error;
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }

    const info = await response.json();
    if (info?.type === 'dir') {
        triggerBatchDataDownload([path], getZipName(path));
        return;
    }
    triggerNativeDownload(buildApiUrl('/data/download', { path }));
}

export function triggerBatchDataDownload(paths, filename = 'data-selection.zip') {
    submitDownloadForm(buildApiUrl('/data/download-batch'), { paths, filename });
}

export async function downloadDataPaths(paths, options = {}) {
    const { filename = 'data-selection.zip', zipThreshold = 1 } = options;
    const uniquePaths = [...new Set((paths || []).filter(Boolean))];
    if (uniquePaths.length === 0) return;

    if (uniquePaths.length === 1 && uniquePaths.length <= zipThreshold) {
        await triggerDataDownload(uniquePaths[0]);
        return;
    }

    triggerBatchDataDownload(uniquePaths, filename);
}

export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function downloadDataUrl(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
