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

module.exports = {
    parseTsvStream,
    stripUtf8Bom,
};
