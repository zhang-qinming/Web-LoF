export function scrollElementNearViewportCenter(element, options = {}) {
    if (!element || typeof window === 'undefined') return;

    const {
        behavior = 'auto',
        viewportOffset = 0.12,
    } = options;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) return;

    const targetTop = rect.top + window.scrollY - ((viewportHeight * 0.5) - (rect.height * 0.5)) - (viewportHeight * viewportOffset);
    const maxTop = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
    const top = Math.min(Math.max(targetTop, 0), maxTop);

    withScrollAnchoringDisabled(() => {
        window.scrollTo({ top, left: window.scrollX, behavior });
    });
}

export function scrollElementIntoNearestView(element, options = {}) {
    if (!element || typeof window === 'undefined') return;

    const {
        behavior = 'auto',
        block = 'nearest',
        inline = 'nearest',
    } = options;

    withScrollAnchoringDisabled(() => {
        element.scrollIntoView({ behavior, block, inline });
    });
}

function withScrollAnchoringDisabled(callback) {
    const root = document.documentElement;
    const body = document.body;
    const previousRootAnchor = root.style.overflowAnchor;
    const previousBodyAnchor = body?.style.overflowAnchor;

    root.style.overflowAnchor = 'none';
    if (body) body.style.overflowAnchor = 'none';

    try {
        callback();
    } finally {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                root.style.overflowAnchor = previousRootAnchor;
                if (body) body.style.overflowAnchor = previousBodyAnchor;
            });
        });
    }
}
