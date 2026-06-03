import React from 'react';
import {
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Switch,
    Typography,
    Box,
} from '@mui/material';
import {
    Download,
} from '@mui/icons-material';
import {
    SIDE_META,
    exportPng,
    exportSvg,
    sanitizeFileNamePart,
} from './shared';

function ControlBlock({ title, children }) {
    return (
        <Box sx={{ minWidth: { xs: '100%', sm: 180, lg: 170 } }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475467', mb: 1 }}>
                {title}
            </Typography>
            {children}
        </Box>
    );
}

export default function TraitProgramGraphControls({
    clearSelection,
    discordantOnly,
    fileId,
    gammaSign,
    gammaThreshold,
    graph,
    hiddenCollapsedCount,
    maxGenesPerProgram,
    onDiscordantOnlyChange,
    onGammaSignChange,
    onGammaThresholdChange,
    onMaxGenesPerProgramChange,
    onSelectedGeneClear,
    onSelectedProgramClear,
    onSideFilterChange,
    selectedGene,
    selectedGeneKey,
    selectedGeneOccurrences,
    selectedProgram,
    sideFilter,
    svgRef,
}) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', xl: 'flex-start' }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2.25}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ flex: 1 }}
                    >
                        <ControlBlock title="Gamma threshold">
                            <Slider
                                min={0}
                                max={2}
                                step={0.05}
                                value={gammaThreshold}
                                onChange={(_event, value) => onGammaThresholdChange(value)}
                                valueLabelDisplay="auto"
                                size="small"
                            />
                        </ControlBlock>

                        <ControlBlock title="Max genes / program">
                            <Slider
                                min={1}
                                max={24}
                                step={1}
                                value={maxGenesPerProgram}
                                onChange={(_event, value) => onMaxGenesPerProgramChange(value)}
                                valueLabelDisplay="auto"
                                size="small"
                            />
                        </ControlBlock>

                        <ControlBlock title="Gamma sign">
                            <FormControl fullWidth size="small">
                                <InputLabel id="gamma-sign-label">Gamma sign</InputLabel>
                                <Select
                                    labelId="gamma-sign-label"
                                    value={gammaSign}
                                    label="Gamma sign"
                                    onChange={(event) => onGammaSignChange(event.target.value)}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="positive">Positive only</MenuItem>
                                    <MenuItem value="negative">Negative only</MenuItem>
                                </Select>
                            </FormControl>
                        </ControlBlock>

                        <ControlBlock title="Visible side">
                            <FormControl fullWidth size="small">
                                <InputLabel id="side-filter-label">Side</InputLabel>
                                <Select
                                    labelId="side-filter-label"
                                    value={sideFilter}
                                    label="Side"
                                    onChange={(event) => onSideFilterChange(event.target.value)}
                                >
                                    <MenuItem value="both">Program + regulator</MenuItem>
                                    <MenuItem value="program">Program only</MenuItem>
                                    <MenuItem value="regulator">Regulator only</MenuItem>
                                </Select>
                            </FormControl>
                        </ControlBlock>

                        <ControlBlock title="Flags">
                            <FormControlLabel
                                control={(
                                    <Switch
                                        checked={discordantOnly}
                                        onChange={(event) => onDiscordantOnlyChange(event.target.checked)}
                                    />
                                )}
                                label="Discordant only"
                                sx={{ mt: 0.2 }}
                            />
                        </ControlBlock>
                    </Stack>

                    <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}
                        sx={{ minWidth: { xl: 280 } }}
                    >
                        <Button size="small" variant="outlined" onClick={clearSelection}>
                            Clear highlight
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Download />}
                            onClick={() => svgRef.current && exportSvg(svgRef.current, `${sanitizeFileNamePart(fileId)}_trait_program_gene.svg`)}
                        >
                            SVG
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<Download />}
                            onClick={() => svgRef.current && exportPng(svgRef.current, `${sanitizeFileNamePart(fileId)}_trait_program_gene.png`)}
                        >
                            PNG
                        </Button>
                    </Stack>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`${graph.counts.totalPrograms} programs`} size="small" />
                    <Chip
                        label={`${graph.counts.leftPrograms} left`}
                        size="small"
                        sx={{ color: SIDE_META.program.accent, borderColor: SIDE_META.program.accent }}
                        variant="outlined"
                    />
                    <Chip
                        label={`${graph.counts.rightPrograms} right`}
                        size="small"
                        sx={{ color: SIDE_META.regulator.accent, borderColor: SIDE_META.regulator.accent }}
                        variant="outlined"
                    />
                    <Chip label={`${graph.counts.hiddenPrograms} hidden`} size="small" variant="outlined" />
                    <Chip label={`${hiddenCollapsedCount} no overlap`} size="small" variant="outlined" />
                    {selectedProgram && (
                        <Chip
                            label={selectedProgram}
                            color="warning"
                            size="small"
                            onDelete={onSelectedProgramClear}
                        />
                    )}
                    {selectedGeneKey && (
                        <Chip
                            label={`${selectedGene?.geneLabel || selectedGene?.gene || selectedGeneKey} · ${selectedGeneOccurrences.length} rows`}
                            color="primary"
                            size="small"
                            onDelete={onSelectedGeneClear}
                        />
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
