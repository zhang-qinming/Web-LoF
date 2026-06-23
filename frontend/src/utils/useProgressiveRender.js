import React from 'react';

function scheduleFrame(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        const frameId = window.requestAnimationFrame(callback);
        return () => window.cancelAnimationFrame(frameId);
    }

    const timeoutId = setTimeout(callback, 0);
    return () => clearTimeout(timeoutId);
}

export function useProgressiveCount(total, {
    resetKey = 'default',
    initialCount = 10,
    step = 10,
} = {}) {
    const key = String(resetKey);
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeInitial = Math.max(1, Number(initialCount) || 1);
    const safeStep = Math.max(1, Number(step) || 1);
    const [state, setState] = React.useState({ key: '', count: 0 });

    React.useEffect(() => {
        let cancelled = false;
        let cancelFrame = () => {};
        let nextCount = Math.min(safeInitial, safeTotal);

        const advance = () => {
            cancelFrame = scheduleFrame(() => {
                if (cancelled) return;

                React.startTransition(() => {
                    setState({ key, count: nextCount });
                });

                if (nextCount < safeTotal) {
                    nextCount = Math.min(safeTotal, nextCount + safeStep);
                    advance();
                }
            });
        };

        if (safeTotal === 0) {
            setState({ key, count: 0 });
        } else {
            advance();
        }

        return () => {
            cancelled = true;
            cancelFrame();
        };
    }, [key, safeInitial, safeStep, safeTotal]);

    return state.key === key ? Math.min(state.count, safeTotal) : 0;
}

export function useStagedMount(resetKey = 'default', stageCount = 1) {
    const key = String(resetKey);
    const safeStageCount = Math.max(0, Number(stageCount) || 0);
    const [state, setState] = React.useState({ key: '', stage: 0 });

    React.useEffect(() => {
        let cancelled = false;
        let cancelFrame = () => {};
        let nextStage = 1;

        const advance = () => {
            cancelFrame = scheduleFrame(() => {
                if (cancelled) return;

                React.startTransition(() => {
                    setState({ key, stage: nextStage });
                });

                if (nextStage < safeStageCount) {
                    nextStage += 1;
                    advance();
                }
            });
        };

        setState({ key, stage: 0 });
        if (safeStageCount > 0) advance();

        return () => {
            cancelled = true;
            cancelFrame();
        };
    }, [key, safeStageCount]);

    return state.key === key ? Math.min(state.stage, safeStageCount) : 0;
}
