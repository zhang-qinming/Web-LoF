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
