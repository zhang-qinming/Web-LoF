import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebouncedControlValue(value, onCommit, {
    delay = 300,
    equality = Object.is,
} = {}) {
    const [draftValue, setDraftValue] = useState(value);
    const commitRef = useRef(onCommit);
    const timerRef = useRef(null);

    useEffect(() => {
        commitRef.current = onCommit;
    }, [onCommit]);

    const clearPending = useCallback(() => {
        if (!timerRef.current) return;
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

    useEffect(() => {
        clearPending();
        if (equality(draftValue, value)) return undefined;

        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            commitRef.current(draftValue);
        }, delay);

        return clearPending;
    }, [clearPending, delay, draftValue, equality, value]);

    const commitNow = useCallback((nextValue = draftValue) => {
        clearPending();
        setDraftValue(nextValue);
        if (!equality(nextValue, value)) commitRef.current(nextValue);
    }, [clearPending, draftValue, equality, value]);

    return [draftValue, setDraftValue, commitNow];
}

export function useIdleRenderGate(ready, key, {
    delay = 120,
    timeout = 1500,
} = {}) {
    const [renderState, setRenderState] = useState({ key: null, canRender: false });

    useEffect(() => {
        setRenderState((previous) => (
            previous.key === key && previous.canRender === false
                ? previous
                : { key, canRender: false }
        ));
        if (!ready) return undefined;

        let cancelled = false;
        let idleId = null;
        let timerId = null;

        const reveal = () => {
            if (!cancelled) setRenderState({ key, canRender: true });
        };

        timerId = window.setTimeout(() => {
            if (typeof window.requestIdleCallback === 'function') {
                idleId = window.requestIdleCallback(reveal, { timeout });
                return;
            }
            reveal();
        }, delay);

        return () => {
            cancelled = true;
            if (timerId != null) window.clearTimeout(timerId);
            if (idleId != null && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(idleId);
            }
        };
    }, [delay, key, ready, timeout]);

    return ready && renderState.key === key && renderState.canRender;
}
