const readline = require('readline');

function stripUtf8Bom(value = '') {
    return String(value).replace(/^\uFEFF/, '');
}

async function parseTsvStream(stream, { maxRows = null } = {}) {
    const rows = [];
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
    });

    let isHeader = true;
    let headers = [];

    for await (const line of rl) {
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
        rows.push(row);

        if (maxRows && rows.length >= maxRows) {
            rl.close();
            stream.destroy();
            break;
        }
    }

    return rows;
}

function parseTsvLine(headers, line) {
    const cols = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
        row[header] = (cols[index] || '').trim();
    });
    return row;
}

async function sampleTsvStream(stream, { maxRows = null } = {}) {
    const rows = [];
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
    });

    let isHeader = true;
    let headers = [];
    let totalRows = 0;

    for await (const line of rl) {
        if (isHeader) {
            headers = line.split('\t').map((value) => stripUtf8Bom(value).trim());
            isHeader = false;
            continue;
        }
        if (!line) continue;

        totalRows += 1;
        if (!maxRows || rows.length < maxRows) {
            rows.push(parseTsvLine(headers, line));
            continue;
        }

        const replaceIndex = Math.floor(Math.random() * totalRows);
        if (replaceIndex < maxRows) {
            rows[replaceIndex] = parseTsvLine(headers, line);
        }
    }

    return {
        rows,
        totalRows,
        truncated: Boolean(maxRows && totalRows > maxRows),
    };
}

module.exports = {
    parseTsvStream,
    sampleTsvStream,
    stripUtf8Bom,
};
