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
    return tables.map((tableName) => databasePackage({
        id: `database-table-${tableName.replace(/_/g, '-')}`,
        title: tableName,
        description: `MySQL table ${tableName} exported as TSV.`,
        rootEntryName: tableName,
        tables: [tableName],
    }));
}

function getDataPackageDefinition(packageId) {
    return getDataPackageDefinitions().find((item) => item.id === packageId) || null;
}

async function getDataPackageStatus(definition) {
    const archiveStat = await statPackageArchive(definition.id);
    return {
        id: definition.id,
        type: definition.type,
        title: definition.title,
        description: definition.description,
        archive: toPackageArchiveResponse(definition.id, archiveStat),
        tableCount: definition.tables.length,
    };
}

module.exports = {
    getDataPackageDefinition,
    getDataPackageDefinitions,
    getDataPackageStatus,
};
