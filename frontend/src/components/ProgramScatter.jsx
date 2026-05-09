import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';

const COLORS = {
    other:              '#b0b0b0',
    program_enriched:   '#FEA601',
    regulator_enriched: '#4783B5',
    both_enriched:      '#34A853',
};

const LEGEND_LABELS = {
    other:              'Other',
    program_enriched:   'Program enriched',
    regulator_enriched: 'Regulator enriched',
    both_enriched:      'Both enriched',
};

export default function ProgramScatter({ fileId }) {
    const { data, error, isLoading } = useSWR(
        fileId ? `/api/programs/${fileId}` : null,
        fetcher
    );

    const traceData = useMemo(() => {
        if (!data?.data) return [];

        const rows = data.data.map(r => ({
            x:           parseFloat(r.program_score) || 0,
            y:           parseFloat(r.regulator_score) || 0,
            program:     r.Program     || '',
            label:       r.label       || '',
            color:       r.color       || 'other',
            progP:       parseFloat(r.MEANgamma_top100_shet_adjusted_P) || 0,
            regP:        parseFloat(r.P_withShet) || 0,
            progGamma:   parseFloat(r.MEANgamma_top100) || 0,
            regBeta:     parseFloat(r.beta_withShet) || 0,
        }));

        // 保持颜色顺序
        const traces = [];
        for (const key of ['other', 'program_enriched', 'regulator_enriched', 'both_enriched']) {
            const pts = rows.filter(r => r.color === key);
            if (pts.length === 0) continue;

            const hasLabel = pts.some(p => p.label);

            traces.push({
                x: pts.map(p => p.x),
                y: pts.map(p => p.y),
                mode: hasLabel ? 'markers+text' : 'markers',
                type: 'scatter',
                marker: {
                    size: 11,
                    color: COLORS[key],
                    opacity: 0.88,
                    line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
                },
                text: pts.map(p => p.label),
                textposition: 'top center',
                textfont: { size: 11, color: '#444', family: 'Arial, sans-serif' },
                name: LEGEND_LABELS[key],
                legendgroup: key,
                showlegend: true,
                hovertemplate: (
                    '<b>Program %{customdata[0]}</b><br>' +
                    'Program score: %{x:.3f}  (P = %{customdata[1]:.1e})<br>' +
                    'Regulator score: %{y:.3f}  (P = %{customdata[2]:.1e})<br>' +
                    'γ = %{customdata[3]:.4f}   β = %{customdata[4]:.4f}<br>' +
                    '<b>%{customdata[5]}</b>' +
                    '<extra></extra>'
                ),
                customdata: pts.map(p => [p.program, p.progP, p.regP, p.progGamma, p.regBeta, LEGEND_LABELS[key]]),
            });
        }
        return traces;
    }, [data]);

    const layout = useMemo(() => ({
        title: {
            text: `Program × Regulator — ${fileId || ''}`,
            font: { size: 22, family: 'Arial, sans-serif', color: '#333' },
            x: 0.01,
        },
        xaxis: {
            title: {
                text: 'Program burden effect,  signed −log₁₀(P)',
                font: { size: 16, family: 'Arial, sans-serif', color: '#555' },
            },
            zeroline: true,
            zerolinewidth: 1.5,
            zerolinecolor: '#888',
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: '#f0f0f0',
            showline: true,
            linewidth: 1,
            linecolor: '#ccc',
            ticks: 'inside',
            tickfont: { size: 13, color: '#666' },
        },
        yaxis: {
            title: {
                text: 'Regulator-burden correlation,  signed −log₁₀(P)',
                font: { size: 16, family: 'Arial, sans-serif', color: '#555' },
            },
            zeroline: true,
            zerolinewidth: 1.5,
            zerolinecolor: '#888',
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: '#f0f0f0',
            showline: true,
            linewidth: 1,
            linecolor: '#ccc',
            ticks: 'inside',
            tickfont: { size: 13, color: '#666' },
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'white',
            bordercolor: '#ccc',
            font: { size: 13, family: 'Arial, sans-serif', color: '#333' },
        },
        margin: { l: 80, r: 40, t: 70, b: 70 },
        plot_bgcolor: '#fafafa',
        paper_bgcolor: 'white',
        showlegend: true,
        legend: {
            title: { text: '' },
            x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top',
            bgcolor: 'rgba(255,255,255,0.85)',
            bordercolor: '#e0e0e0',
            borderwidth: 1,
            font: { size: 13, color: '#444' },
            itemsizing: 'constant',
        },
        shapes: [
            // 水平虚线 — y=0
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0,
              line: { color: '#aaa', width: 1.5, dash: '6px,3px' }, layer: 'below' },
            // 垂直虚线 — x=0
            { type: 'line', yref: 'paper', y0: 0, y1: 1, x0: 0, x1: 0,
              line: { color: '#aaa', width: 1.5, dash: '6px,3px' }, layer: 'below' },
        ],
    }), [fileId]);

    if (!fileId) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Select a trait to view Program scatter</Typography>
            </Box>
        );
    }

    if (error) return <Alert severity="error">{error.message}</Alert>;

    return (
        <Box sx={{ position: 'relative' }}>
            {isLoading && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
                    <CircularProgress />
                </Box>
            )}
            {traceData.length > 0 ? (
                <Plot
                    data={traceData}
                    layout={layout}
                    config={{ responsive: true, displaylogo: false }}
                    style={{ width: '100%', height: 650 }}
                />
            ) : !isLoading ? (
                <Alert severity="info">No data available for this trait</Alert>
            ) : null}
        </Box>
    );
}
