// Browse.jsx
import React from "react";
import GwasDataList from "../components/GwasDataList";

export default function Browse() {
    const columns = [
        { id: "Trait", label: "Trait" },
        { id: "mesh_term", label: "Mesh Term" },
        { id: "mesh_id", label: "Mesh ID" },
        { id: "sample_size", label: "Sample Size" },
        { id: "n_blocks", label: "n_blocks" },
        { id: "n_variants", label: "n_variants" },
    ];

    return (
        <GwasDataList
            title="Browse All Traits"
            columns={columns}
            defaultSortBy="Trait"
            defaultOrder="ASC"
        />
    );
}
