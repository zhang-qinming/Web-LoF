function BrowserBuffer(length = 0) {
    return new Uint8Array(length);
}

BrowserBuffer.isBuffer = () => false;
BrowserBuffer.from = (value) => {
    if (value instanceof Uint8Array) return value;
    if (Array.isArray(value) || value instanceof ArrayBuffer) return new Uint8Array(value);
    return new TextEncoder().encode(String(value ?? ''));
};
BrowserBuffer.alloc = (length) => new Uint8Array(length);

export const Buffer = BrowserBuffer;
export default { Buffer };
