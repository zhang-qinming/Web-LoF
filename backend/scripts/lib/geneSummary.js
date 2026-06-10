const REFRESH_GENE_SUMMARY_SQL = `
DELETE FROM gene_summary;

INSERT INTO gene_summary (
    gene_key,
    gene_symbol,
    ensg_id,
    gene_label,
    chromosome,
    begin_pos,
    end_pos,
    gene_name,
    gene_type,
    total_rows,
    total_programs,
    total_traits,
    program_role_rows,
    regulator_role_rows
)
SELECT
    COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.gene_label, '')) AS gene_key,
    MAX(COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gi.symbol, ''))) AS gene_symbol,
    MAX(NULLIF(gpte.ensg_id, '')) AS ensg_id,
    MAX(COALESCE(NULLIF(gpte.gene_label, ''), NULLIF(gpte.gene_symbol, ''), NULLIF(gi.symbol, ''), NULLIF(gpte.ensg_id, ''))) AS gene_label,
    MAX(gi.chromosome) AS chromosome,
    MAX(gi.begin_pos) AS begin_pos,
    MAX(gi.end_pos) AS end_pos,
    MAX(gi.gene_name) AS gene_name,
    MAX(gi.gene_type) AS gene_type,
    COUNT(*) AS total_rows,
    COUNT(DISTINCT gpte.program) AS total_programs,
    COUNT(DISTINCT gpte.trait_id) AS total_traits,
    SUM(gpte.role = 'program') AS program_role_rows,
    SUM(gpte.role = 'regulator') AS regulator_role_rows
FROM gene_program_trait_edge gpte
LEFT JOIN gene_info_hg37_matched gi
    ON gi.ensembl = gpte.ensg_id
WHERE COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.gene_label, '')) IS NOT NULL
GROUP BY gene_key;
`;

const REFRESH_GENE_SUMMARY_STATEMENTS = REFRESH_GENE_SUMMARY_SQL
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

async function refreshGeneSummary(connection) {
    for (const statement of REFRESH_GENE_SUMMARY_STATEMENTS) {
        await connection.query(statement);
    }
}

module.exports = {
    REFRESH_GENE_SUMMARY_SQL,
    refreshGeneSummary,
};
