import React from 'react';

export function useAfterFirstPaint(resetKey = 'default') {
    const [paintedKey, setPaintedKey] = React.useState(null);
    const key = String(resetKey);

    React.useEffect(() => {
        let frameId = 0;
        let timeoutId = 0;
        const canUseAnimationFrame = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
        const markReady = () => {
            React.startTransition(() => {
                setPaintedKey(key);
            });
        };

        if (canUseAnimationFrame) {
            frameId = window.requestAnimationFrame(markReady);
        } else {
            timeoutId = setTimeout(markReady, 0);
        }

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [key]);

    return paintedKey === key;
}
