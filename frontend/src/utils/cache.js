export function createTtlCache({ ttlMs = 0, maxEntries = 100 } = {}) {
    const entries = new Map();
    const hasTtl = Number.isFinite(ttlMs) && ttlMs > 0;
    const limit = Math.max(1, Number(maxEntries) || 100);

    const isExpired = (entry, now = Date.now()) => (
        hasTtl && entry?.expiresAt != null && entry.expiresAt <= now
    );

    const pruneExpired = () => {
        if (!hasTtl || entries.size === 0) return;
        const now = Date.now();
        for (const [key, entry] of entries) {
            if (isExpired(entry, now)) entries.delete(key);
        }
    };

    const evictOverflow = () => {
        while (entries.size > limit) {
            const oldestKey = entries.keys().next().value;
            if (oldestKey === undefined) return;
            entries.delete(oldestKey);
        }
    };

    return {
        get size() {
            pruneExpired();
            return entries.size;
        },
        get(key) {
            const entry = entries.get(key);
            if (!entry) return undefined;
            if (isExpired(entry)) {
                entries.delete(key);
                return undefined;
            }
            entries.delete(key);
            entries.set(key, entry);
            return entry.value;
        },
        set(key, value) {
            pruneExpired();
            if (entries.has(key)) entries.delete(key);
            entries.set(key, {
                value,
                expiresAt: hasTtl ? Date.now() + ttlMs : null,
            });
            evictOverflow();
            return this;
        },
        has(key) {
            const entry = entries.get(key);
            if (!entry) return false;
            if (isExpired(entry)) {
                entries.delete(key);
                return false;
            }
            return true;
        },
        delete(key) {
            return entries.delete(key);
        },
        clear() {
            entries.clear();
        },
        keys() {
            pruneExpired();
            return entries.keys();
        },
        values() {
            pruneExpired();
            return Array.from(entries.values(), (entry) => entry.value).values();
        },
        entries() {
            pruneExpired();
            return Array.from(entries.entries(), ([key, entry]) => [key, entry.value]).values();
        },
        [Symbol.iterator]() {
            return this.entries();
        },
    };
}
