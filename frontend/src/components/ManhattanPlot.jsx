import React, { useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography
} from '@mui/material';

export default function ManhattanPlot({
    data = [],
    chromOrder: customChromOrder = null,
    gap = 3000000,
    markerSize = 2,
    genomewideP = 5e-8,
    suggestiveP = 1e-5,
    height = '100%',
    width = undefined,
    title = 'Manhattan Plot',
    onPointClick = null,
    colors = ['#1f77b4', '#ff7f0e'],
    bgColors = ['#d3d3d3', '#e1e1e1'],
}) {
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [svgW, setSvgW] = useState(1200);
    const [svgH, setSvgH] = useState(800);
    const plotRef = useRef(null);

    const chromOrder = useMemo(() => {
        return customChromOrder ?? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
            '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
    }, [customChromOrder]);

    const validChromSet = useMemo(() => new Set(chromOrder), [chromOrder]);

    const chromLengths = useMemo(() => ({
        "1": 248956422, "2": 242193529, "3": 198295559, "4": 190214555, "5": 181538259, "6": 170805979,
        "7": 159345973, "8": 145138636, "9": 138394717, "10": 133797422, "11": 135086622, "12": 133275309,
        "13": 114364328, "14": 107043718, "15": 101991189, "16": 90338345, "17": 83257441, "18": 80373285,
        "19": 58617616, "20": 64444167, "21": 46709983, "22": 50818468, "X": 156040895, "Y": 57227415
    }), []);

    const hoverContent = useMemo(() => (['CHR', 'BP', 'POS', 'rsID', 'EA', 'NEA',
        'MAF', 'BETA', 'SE', 'P', 'Zscore', 'EAF', 'Filename']), []);

    const chrOffsets = useMemo(() => {
        const offsets = {};
        let offset = 0;
        for (const c of chromOrder) {
            if (chromLengths[c]) {
                offsets[c] = offset;
                offset += chromLengths[c] + gap;
            }
        }
        return offsets;
    }, [chromOrder, chromLengths, gap]);

    const chromRanges = useMemo(() => {
        const ranges = [];
        let offset = 0;
        for (const c of chromOrder) {
            if (chromLengths[c]) {
                ranges.push({ chr: c, start: offset, end: offset + chromLengths[c], mid: offset + chromLengths[c] / 2 });
                offset += chromLengths[c] + gap;
            }
        }
        return ranges;
    }, [chromOrder, chromLengths, gap]);

    const ticks = useMemo(() => chromRanges.map((range) => ({
        chr: range.chr, pos: range.mid,
    })), [chromRanges]);

    const processedRows = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data
            .map((d) => {
                const CHR = d.CHR != null ? String(d.CHR) : null;
                const BP = d.BP != null ? Number(d.BP) : NaN;
                let P = d.P != null ? Number(d.P) : NaN;
                if (!isFinite(P)) P = NaN;
                if (P === 0) P = 1e-100;
                const hoverText = hoverContent
                    .filter(key => d[key] !== undefined && d[key] !== null)
                    .map(key => {
                        const value = d[key];
                        return key === 'P' && typeof value === 'number'
                            ? `${key}: ${value.toExponential(4)}`
                            : `${key}: ${value}`;
                    })
                    .join('<br>');
                return { ...d, CHR, BP, P, hoverText };
            })
            .filter((r) => validChromSet.has(r.CHR) && r.CHR && isFinite(r.BP) && isFinite(r.P) && r.P > 0)
            .map((r) => ({ ...r, neglogp: -Math.log10(r.P) }));
    }, [data, hoverContent, validChromSet]);

    const rowsWithPosition = useMemo(() => {
        return processedRows.map(row => ({
            ...row, BPonPlot: row.BP + (chrOffsets[row.CHR] || 0)
        }));
    }, [processedRows, chrOffsets]);

    const maxNegLogP = useMemo(() => {
        if (!rowsWithPosition || rowsWithPosition.length === 0) return 13;
        return rowsWithPosition.reduce((m, r) => r.neglogp > m ? r.neglogp : m, -Infinity) || 13;
    }, [rowsWithPosition]);

    const traceData = useMemo(() => {
        const x = rowsWithPosition.map(r => r.BPonPlot);
        const y = rowsWithPosition.map(r => r.neglogp);
        const text = rowsWithPosition.map(r => r.hoverText);
        const customdata = rowsWithPosition.map(r => r);

        const colorMap = {};
        chromOrder.forEach((chr, i) => {
            colorMap[chr] = colors[i % colors.length];
        });

        const markerColors = rowsWithPosition.map(r => colorMap[r.CHR] || colors[0]);

        return [{
            x, y, text, customdata, mode: 'markers', type: 'scattergl',
            marker: { size: markerSize, color: markerColors, opacity: 0.8 },
            hoverinfo: 'text', showlegend: false
        }];
    }, [rowsWithPosition, chromOrder, colors, markerSize]);

    const bgShapes = useMemo(() => chromRanges.map((range, idx) => ({
        type: 'rect', xref: 'x', yref: 'paper',
        x0: range.start, x1: range.end, y0: 0, y1: 1,
        fillcolor: bgColors[idx % bgColors.length],
        line: { width: 0.02 }, layer: 'below'
    })), [chromRanges, bgColors]);

    const shapes = useMemo(() => [...bgShapes, {
        type: 'line', xref: 'paper', x0: 0, x1: 1,
        y0: -Math.log10(genomewideP), y1: -Math.log10(genomewideP),
        line: { color: 'rgba(0,0,0,0.5)', width: 1, dash: '5px,2px' }
    }, {
        type: 'line', xref: 'paper', x0: 0, x1: 1,
        y0: -Math.log10(suggestiveP), y1: -Math.log10(suggestiveP),
        line: { color: 'rgba(0,0,0,0.4)', width: 1, dash: 'dot' }
    }], [bgShapes, genomewideP, suggestiveP]);

    const annotations = useMemo(() => [{
        xref: 'paper', x: 1.0, y: -Math.log10(genomewideP),
        xanchor: 'left', yanchor: 'middle',
        text: `${genomewideP.toExponential(1)}`, showarrow: false, font: { size: 12 }
    }, {
        xref: 'paper', x: 1.0, y: -Math.log10(suggestiveP),
        xanchor: 'left', yanchor: 'middle',
        text: `${suggestiveP.toExponential(1)}`, showarrow: false, font: { size: 12 }
    }], [genomewideP, suggestiveP]);

    const tickvals = useMemo(() => ticks.map(t => t.pos), [ticks]);
    const ticktext = useMemo(() => ticks.map(t => t.chr), [ticks]);

    const layout = useMemo(() => ({
        title: { text: title, x: 0.01, font: { size: 18, family: 'Arial, sans-serif', weight: 'bold' } },
        xaxis: {
            tickmode: 'array', tickvals, ticktext, showgrid: false,
            range: [0, chromRanges[chromRanges.length - 1]?.end || 0], autorange: false,
            title: { text: 'Chromosome', font: { size: 16, family: 'Arial, sans-serif', weight: 'bold' } },
            linewidth: 1, fixedrange: true,
            tickfont: { family: 'Arial, sans-serif', size: 14, color: '#333', weight: 'bold' }
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { size: 16, family: 'Arial, sans-serif', weight: 'bold' } },
            range: [0, Math.ceil(maxNegLogP) + 1],
            ticks: 'outside', ticklen: 5, tickwidth: 1.5, tickcolor: '#777',
            rangemode: 'nonnegative', linewidth: 1, position: 0,
            tickfont: { family: 'Arial, sans-serif', size: 14, color: '#555', weight: 'bold' }
        },
        hovermode: 'closest', shapes, annotations,
        margin: { l: 80, r: 80, t: 80, b: 80 },
        plot_bgcolor: 'rgba(255,255,255,1)', paper_bgcolor: 'rgba(255,255,255,1)',
    }), [title, tickvals, ticktext, chromRanges, maxNegLogP, shapes, annotations]);

    function exportSVG(gd, w, h, filename) {
        Plotly.toImage(gd, { format: 'svg', width: w, height: h })
            .then(function (dataUrl) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename + '.svg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(err => {
                console.error('SVG export failed:', err);
            });
    }

    const config = useMemo(() => ({
        responsive: true, displaylogo: false,
        edits: { legendPosition: true },
        modeBarButtonsToAdd: [{
            name: 'toSVG', title: 'Download plot as SVG',
            icon: Plotly.Icons.disk,
            click: function (gd) {
                plotRef.current = gd;
                setExportModalOpen(true);
            }
        }],
        modeBarButtonsToRemove: ['select2d', 'lasso2d'],
        displayModeBar: true,
    }), []);

    const handleClick = (evt) => {
        if (!evt || !evt.points || !evt.points.length) return;
        const p = evt.points[0];
        if (typeof onPointClick === 'function') onPointClick(p.customdata || null);
    };

    if (rowsWithPosition.length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>暂无数据，请稍后或刷新</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Plot
                data={traceData}
                layout={layout}
                config={config}
                onClick={handleClick}
                useResizeHandler={true}
                style={{ width: width || '100%', height }}
            />

            <Dialog open={exportModalOpen} onClose={() => setExportModalOpen(false)}>
                <DialogTitle>导出 SVG</DialogTitle>
                <DialogContent>
                    <TextField label="宽度" type="number" value={svgW}
                               onChange={(e) => setSvgW(Number(e.target.value))}
                               sx={{ mt: 1, mr: 2 }} />
                    <TextField label="高度" type="number" value={svgH}
                               onChange={(e) => setSvgH(Number(e.target.value))}
                               sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExportModalOpen(false)}>取消</Button>
                    <Button variant="contained" onClick={() => {
                        if (plotRef.current) exportSVG(plotRef.current, svgW, svgH, title);
                        setExportModalOpen(false);
                    }}>导出</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
