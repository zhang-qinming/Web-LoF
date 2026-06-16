const readline = require('readline');
const { createRequestAbortError, throwIfAborted } = require('./http');

function stripUtf8Bom(value = '') {
    return String(value).replace(/^\uFEFF/, '');
}

async function parseTsvStream(stream, { maxRows = null, signal = null } = {}) {
    const rows = [];
    await forEachTsvRow(stream, (row) => {
        rows.push(row);
    }, { maxRows, signal });
    return rows;
}

async function forEachTsvRow(stream, onRow, { maxRows = null, signal = null } = {}) {
    throwIfAborted(signal);

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
    });
    const abort = () => {
        rl.close();
        stream.destroy();
    };

    let isHeader = true;
    let headers = [];
    let rowCount = 0;
    let truncated = false;

    if (signal) signal.addEventListener('abort', abort, { once: true });

    try {
        for await (const line of rl) {
            throwIfAborted(signal);

            const cols = line.split('\t');
            if (isHeader) {
                headers = cols.map((value) => stripUtf8Bom(value).trim());
                isHeader = false;
                continue;
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header] = (cols[index] || '').trim();
            });
            rowCount += 1;
            await onRow(row, rowCount);
            throwIfAborted(signal);

            if (maxRows && rowCount >= maxRows) {
                truncated = true;
                rl.close();
                stream.destroy();
                break;
            }
        }
    } catch (err) {
        if (signal?.aborted) throw createRequestAbortError();
        throw err;
    } finally {
        if (signal) signal.removeEventListener('abort', abort);
    }

    if (signal?.aborted) throw createRequestAbortError();
    return { rowCount, truncated };
}

module.exports = {
    forEachTsvRow,
    parseTsvStream,
    stripUtf8Bom,
};
