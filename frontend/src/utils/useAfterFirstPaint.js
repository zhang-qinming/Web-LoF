import React from 'react';

export function useAfterFirstPaint(resetKey = 'default') {
    const [paintedKey, setPaintedKey] = React.useState(null);
    const key = String(resetKey);

    React.useEffect(() => {
        let frameId = 0;
        let timeoutId = 0;
        let marked = false;
        const canUseAnimationFrame = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
        const markReady = () => {
            if (marked) return;
            marked = true;
            setPaintedKey(key);
        };

        if (canUseAnimationFrame) {
            frameId = window.requestAnimationFrame(markReady);
        }
        timeoutId = setTimeout(markReady, canUseAnimationFrame ? 120 : 0);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [key]);

    return paintedKey === key;
}
