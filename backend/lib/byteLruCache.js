class ByteLruCache {
    constructor({ maxBytes, maxEntries, sizeOf = defaultSizeOf }) {
        this.maxBytes = Math.max(0, Number(maxBytes) || 0);
        this.maxEntries = Math.max(0, Number(maxEntries) || 0);
        this.sizeOf = sizeOf;
        this.entries = new Map();
        this.totalBytes = 0;
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;

        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        const bytes = Math.max(0, Number(this.sizeOf(value)) || 0);
        this.delete(key);

        if (
            this.maxBytes === 0
            || this.maxEntries === 0
            || bytes > this.maxBytes
        ) {
            return false;
        }

        this.entries.set(key, { value, bytes });
        this.totalBytes += bytes;
        this.evict();
        return this.entries.has(key);
    }

    delete(key) {
        const entry = this.entries.get(key);
        if (!entry) return false;

        this.entries.delete(key);
        this.totalBytes -= entry.bytes;
        return true;
    }

    evict() {
        while (
            this.entries.size > this.maxEntries
            || this.totalBytes > this.maxBytes
        ) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey == null) break;
            this.delete(oldestKey);
        }
    }
}

function defaultSizeOf(value) {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

module.exports = {
    ByteLruCache,
};
