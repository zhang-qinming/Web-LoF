// Trait.jsx
import React from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import GwasDataList from "../components/GwasDataList";
import TraitManhattan from "../components/TraitManhattan";

export default function Trait() {
    const { traitName } = useParams();

    const columns = [
        { id: "CHR", label: "CHR" },
        { id: "BP", label: "BP" },
        { id: "rsID", label: "rsID" },
        { id: "MAF", label: "MAF" },
        { id: "BETA", label: "BETA" },
        { id: "P", label: "P" },
    ];

    return (
        <>
            <TraitManhattan traitName={traitName} />
            <Box sx={{ p: 0 }}>
                <GwasDataList
                    title={`${traitName} - GWAS Data`}
                    traitName={traitName}
                    columns={columns}
                    defaultSortBy="CHR"
                    defaultOrder="ASC"
                />
            </Box>
        </>
    );
}
