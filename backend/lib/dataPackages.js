const { config } = require('./config');
const {
    statPackageArchive,
    toPackageArchiveResponse,
} = require('./dataArchives');

const EXCLUDED_DATA_EXPORT_TABLES = new Set([
    'file_id_mapping',
    'file_metadata',
    'gwas_meta',
    'trait_ldsc',
]);

function databasePackage({ id, title, rootEntryName, tables, description }) {
    return {
        id,
        type: 'database',
        title,
        description,
        rootEntryName,
        tables,
    };
}

function getDataPackageDefinitions() {
    const tables = config.data.dbExportTables.filter((tableName) => !EXCLUDED_DATA_EXPORT_TABLES.has(tableName));
    const definitions = tables.map((tableName) => databasePackage({
        id: `database-table-${tableName.replace(/_/g, '-')}`,
        title: tableName,
        description: `MySQL table ${tableName} exported as TSV.`,
        rootEntryName: tableName,
        tables: [tableName],
    }));

    const associationTables = [
        'program_gene_role_edge',
        'program_trait_scatter_edge',
        'gene_program_trait_edge',
    ].filter((tableName) => tables.includes(tableName));

    if (associationTables.length) {
        definitions.unshift(databasePackage({
            id: 'trait-associations',
            title: 'Trait associations',
            description: 'Program-gene-role, program-trait, and gene-program-trait association tables exported as TSV.',
            rootEntryName: 'trait-associations',
            tables: associationTables,
        }));
    }

    return definitions;
}

function getDataPackageDefinition(packageId) {
    return getDataPackageDefinitions().find((item) => item.id === packageId) || null;
}

async function getDataPackageStatus(definition) {
    const archiveStat = await statPackageArchive(definition.id);
    const archive = toPackageArchiveResponse(definition.id, archiveStat);
    return {
        id: definition.id,
        type: definition.type,
        title: definition.title,
        description: definition.description,
        archive,
        download: {
            available: definition.type === 'database' || archive.exists,
            mode: archive.exists ? 'archive' : (definition.type === 'database' ? 'dynamic' : null),
        },
        tableCount: definition.tables.length,
    };
}

module.exports = {
    getDataPackageDefinition,
    getDataPackageDefinitions,
    getDataPackageStatus,
};
