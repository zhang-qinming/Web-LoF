import React from 'react';
import GwasDataList from '../components/GwasDataList';

export default function Browse() {
    const columns = [
        { id: 'file_id', label: 'File ID' },
        { id: 'gwas_id', label: 'GWAS ID' },
        { id: 'trait_name', label: 'Trait' },
    ];

    return (
        <GwasDataList
            title="Browse All Traits"
            columns={columns}
            defaultSortBy="trait_name"
            defaultOrder="ASC"
        />
    );
}
