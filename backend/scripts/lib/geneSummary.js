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
    CONCAT('perturb:', gi.perturb_symbol) AS gene_key,
    gi.perturb_symbol AS gene_symbol,
    NULLIF(gi.ensembl, '') AS ensg_id,
    COALESCE(NULLIF(gi.symbol, ''), gi.perturb_symbol) AS gene_label,
    gi.chromosome,
    gi.begin_pos,
    gi.end_pos,
    gi.gene_name,
    gi.gene_type,
    COALESCE(by_ensg.total_rows, by_symbol.total_rows, 0) AS total_rows,
    COALESCE(by_ensg.total_programs, by_symbol.total_programs, 0) AS total_programs,
    COALESCE(by_ensg.total_traits, by_symbol.total_traits, 0) AS total_traits,
    COALESCE(by_ensg.program_role_rows, by_symbol.program_role_rows, 0) AS program_role_rows,
    COALESCE(by_ensg.regulator_role_rows, by_symbol.regulator_role_rows, 0) AS regulator_role_rows
FROM gene_info_hg37_matched gi
LEFT JOIN (
    SELECT
        ensg_id,
        COUNT(*) AS total_rows,
        COUNT(DISTINCT program) AS total_programs,
        COUNT(DISTINCT trait_id) AS total_traits,
        SUM(role = 'program') AS program_role_rows,
        SUM(role = 'regulator') AS regulator_role_rows
    FROM gene_program_trait_edge
    WHERE ensg_id IS NOT NULL AND ensg_id <> ''
    GROUP BY ensg_id
) by_ensg
    ON BINARY by_ensg.ensg_id = BINARY gi.ensembl
LEFT JOIN (
    SELECT
        gene_symbol,
        COUNT(*) AS total_rows,
        COUNT(DISTINCT program) AS total_programs,
        COUNT(DISTINCT trait_id) AS total_traits,
        SUM(role = 'program') AS program_role_rows,
        SUM(role = 'regulator') AS regulator_role_rows
    FROM gene_program_trait_edge
    WHERE gene_symbol IS NOT NULL AND gene_symbol <> ''
    GROUP BY gene_symbol
) by_symbol
    ON BINARY by_symbol.gene_symbol = BINARY gi.perturb_symbol
WHERE gi.perturb_tested = TRUE;
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
