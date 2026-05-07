// components/TraitManhattan.jsx
import React, {useEffect, useRef, useState} from "react";
import {getFilteredGwasDataByTrait} from "../api/gwas";
import ManhattanPlot from "./ManhattanPlot";
import {
    Box, Button, CircularProgress, Fade, Grid, TextField, Typography,
    Card, CardContent, CardHeader, Chip, Alert, IconButton,
    Tooltip, Collapse, Divider
} from "@mui/material";
import {
    FilterAlt as FilterIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    BarChart as BarChartIcon,
    Science as ScienceIcon,
    NearMe as NearMeIcon,
    ArrowOutward as ArrowOutwardIcon,
} from "@mui/icons-material";

// 可配置的输入宽度
const INPUT_WIDTHS = {
    chr: 200,
    chromOrder: 600,
    bp: 160,
    p: 150,
    rsid: 200,
    gap: 130,
    marker: 100,
    genomewide: 150,
    suggestive: 150,
};

// 辅助函数
const getChrTokens = (text) =>
    text.replace(/,/g, " ").split(/\s+/).map((s) => s.trim()).filter(Boolean);

const normalizeChrom = (t) => {
    let s = String(t).trim();
    s = s.replace(/^chr/i, "");
    s = s.toUpperCase();
    if (s === "23") s = "X";
    if (s === "24") s = "Y";
    return s;
};

const dedupeKeepOrder = (arr) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
        if (!seen.has(x)) {
            seen.add(x);
            out.push(x);
        }
    }
    return out;
};

// 筛选面板组件
function FilterPanel({
                         CHR, setCHR, BP_start, setBPStart, BP_end, setBPEnd,
                         P_min, setPMin, P_max, setPMax, rsID, setRsID,
                         onApply, onReset, hasChrValues, onUseChrAsOrder,
                         chromOrderInput, onChromOrderChange, gap, setGap,
                         markerSize, setMarkerSize, genomewideP, setGenomewideP,
                         suggestiveP, setSuggestiveP
                     }) {
    const [expanded, setExpanded] = useState(false);

    return (<Card
        elevation={2}
        sx={{
            mb: 3,
            borderRadius: 1,
            border: "1px solid rgba(25, 118, 210, 0.1)",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 245, 245, 0.5) 100%)",
        }}
    >
        <CardHeader
            title={<Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <SettingsIcon color="primary"/>
                <Typography variant="h6" color="primary.main" fontWeight="600">
                    Data filtering and Chart configuration
                </Typography>
            </Box>}
            action={<IconButton
                onClick={() => setExpanded(!expanded)}
                sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease',
                }}
            >
                {expanded ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
            </IconButton>}
            sx={{
                pb: 1, borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
            }}
        />

        <Collapse in={expanded} timeout="auto">
            <CardContent>
                {/* 数据筛选条件 */}
                <Box sx={{mb: 3}}>
                    <Typography variant="subtitle1" fontWeight="600"
                                sx={{mb: 2, display: 'flex', alignItems: 'center', gap: 1}}>
                        <FilterIcon color="action" fontSize="small"/>
                        Data filtering criteria
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md="auto">
                            <Tooltip title="Enter the chrom, separated by commas or spaces.">
                                <TextField
                                    label="CHR"
                                    size="small"
                                    value={CHR}
                                    onChange={(e) => setCHR(e.target.value)}
                                    placeholder="eg: 1, 2, 3 or 1 2 3"
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.chr}, '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                            </Tooltip>
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <Box sx={{display: 'flex', gap: 1}}>
                                <TextField
                                    label="BP start"
                                    size="small"
                                    type="number"
                                    value={BP_start}
                                    onChange={(e) => setBPStart(e.target.value)}
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.bp}, '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                                <TextField
                                    label="BP end"
                                    size="small"
                                    type="number"
                                    value={BP_end}
                                    onChange={(e) => setBPEnd(e.target.value)}
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.bp}, '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                            </Box>
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <Box sx={{display: 'flex', gap: 1}}>
                                <TextField
                                    label="Min P"
                                    size="small"
                                    type="number"
                                    value={P_min}
                                    onChange={(e) => setPMin(e.target.value)}
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.p}, '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                                <TextField
                                    label="Max P"
                                    size="small"
                                    type="number"
                                    value={P_max}
                                    onChange={(e) => setPMax(e.target.value)}
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.p}, '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                            </Box>
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <TextField
                                label="rsID select"
                                size="small"
                                value={rsID}
                                onChange={(e) => setRsID(e.target.value)}
                                placeholder="eg: rs123"
                                sx={{
                                    width: {xs: "100%", sm: INPUT_WIDTHS.rsid}, '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{my: 2}}/>

                {/* 图表配置 */}
                <Box sx={{mb: 3}}>
                    <Typography variant="subtitle1" fontWeight="600"
                                sx={{mb: 2, display: 'flex', alignItems: 'center', gap: 1}}>
                        <BarChartIcon color="action" fontSize="small"/>
                        Chart configuration
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md="auto">
                            <Tooltip title="Set the display order of chrom, separated by commas or spaces.">
                                <TextField
                                    label="chromOrder"
                                    size="small"
                                    value={chromOrderInput}
                                    onChange={onChromOrderChange}
                                    placeholder="eg: 1 2 3 X Y"
                                    sx={{
                                        width: {xs: "100%", sm: INPUT_WIDTHS.chromOrder},
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 1,
                                        }
                                    }}
                                />
                            </Tooltip>
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <Button
                                variant="outlined"
                                size="small"
                                disabled={!hasChrValues}
                                onClick={onUseChrAsOrder}
                                startIcon={<ArrowOutwardIcon
                                    sx={{
                                        transform: 'rotate(90deg)',
                                    }}
                                />}
                                sx={{
                                    textTransform: "none", height: 40, borderRadius: 1,
                                }}
                            >
                                Use CHR as Order
                            </Button>
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <TextField
                                label="gap"
                                size="small"
                                type="number"
                                value={gap}
                                onChange={(e) => setGap(Number(e.target.value))}
                                sx={{
                                    width: {xs: "100%", sm: INPUT_WIDTHS.gap}, '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <TextField
                                label="marker size"
                                size="small"
                                type="number"
                                value={markerSize}
                                onChange={(e) => setMarkerSize(Number(e.target.value))}
                                inputProps={{min: 1, max: 10}}
                                sx={{
                                    width: {xs: "100%", sm: INPUT_WIDTHS.marker}, '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />
                        </Grid>

                        {/* 显著性线配置 */}
                        <Grid item xs={12} sm={6} md="auto">
                            <TextField
                                label="Genome-wide P"
                                size="small"
                                type="number"
                                value={genomewideP}
                                onChange={(e) => setGenomewideP(Number(e.target.value))}
                                slotProps={{
                                    htmlInput: {  // 注意：应该是 htmlInput 而不是 input
                                        step: "1e-8",
                                        min: "0",
                                        max: "1"
                                    }
                                }}
                                sx={{
                                    width: {xs: "100%", sm: INPUT_WIDTHS.genomewide}, '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md="auto">
                            <TextField
                                label="Suggestive P"
                                size="small"
                                type="number"
                                value={suggestiveP}
                                onChange={(e) => setSuggestiveP(Number(e.target.value))}
                                slotProps={{
                                    htmlInput: {  // 注意：应该是 htmlInput 而不是 input
                                        step: "1e-10",
                                        min: "0",
                                        max: "1"
                                    }
                                }}
                                sx={{
                                    width: {xs: "100%", sm: INPUT_WIDTHS.suggestive}, '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                    }
                                }}
                            />
                        </Grid>
                    </Grid>
                </Box>

                {/* 操作按钮 */}
                <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                    <Button
                        variant="outlined"
                        onClick={onReset}
                        startIcon={<RefreshIcon/>}
                        sx={{
                            textTransform: "none", borderRadius: 1, px: 3,
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        onClick={onApply}
                        startIcon={<NearMeIcon/>}
                        sx={{
                            textTransform: "none",
                            borderRadius: 1,
                            px: 3,
                            background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                            '&:hover': {
                                background: "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)",
                            },
                        }}
                    >
                        Apply
                    </Button>
                </Box>
            </CardContent>
        </Collapse>
    </Card>);
}

// 统计信息组件
function StatsPanel({data, loading, genomewideP, suggestiveP}) {
    if (loading) return null;

    const totalPoints = data?.length || 0;
    const significantPoints = data?.filter(d => d.P < genomewideP)?.length || 0;
    const suggestivePoints = data?.filter(d => d.P < suggestiveP && d.P >= genomewideP)?.length || 0;

    return (<Box sx={{mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
        <Chip
            label={`GWAS count: ${totalPoints.toLocaleString()}`}
            color="primary"
            variant="filled"
        />
        <Chip
            label={`Genome-wide: ${significantPoints.toLocaleString()}`}
            color="success"
            variant="filled"
        />
        <Chip
            label={`Suggestive: ${suggestivePoints.toLocaleString()}`}
            color="warning"
            variant="filled"
        />
    </Box>);
}

// 主要方法
export default function TraitManhattan({traitName}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const isFirstLoadRef = useRef(true);
    const chromOrderInputTimerRef = useRef(null);

    // 筛选参数
    const [CHR, setCHR] = useState("");
    const [BP_start, setBPStart] = useState("");
    const [BP_end, setBPEnd] = useState("");
    const [P_min, setPMin] = useState("");
    const [P_max, setPMax] = useState("");
    const [rsID, setRsID] = useState("");
    const [filters, setFilters] = useState({});

    // Manhattan plot 参数
    const defaultChromOrder = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22",];
    const allowChrom = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "X", "Y",];
    const [chromOrder, setChromOrder] = useState(defaultChromOrder);
    const [chromOrderInput, setChromOrderInput] = useState(defaultChromOrder.join(", "));
    const [gap, setGap] = useState(3000000);
    const [markerSize, setMarkerSize] = useState(4);

    // 显著性线配置
    const [genomewideP, setGenomewideP] = useState(5e-8);
    const [suggestiveP, setSuggestiveP] = useState(1e-5);

    const hasChrValues = getChrTokens(CHR).length > 0;

    const useChrAsChromOrder = () => {
        const tokens = getChrTokens(CHR).map(normalizeChrom);
        const valid = tokens.filter((c) => allowChrom.includes(c));
        const uniqValid = dedupeKeepOrder(valid);
        if (uniqValid.length === 0) return;
        setChromOrder(uniqValid);
        setChromOrderInput(uniqValid.join(", "));
        setGap(Math.max(1_000_000, Math.floor((uniqValid.length / 24) * 3_000_000)));
    };

    // 应用筛选条件
    const applyFilters = () => {
        const f = {};
        if (CHR) {
            const inputChr = getChrTokens(CHR).map(normalizeChrom);
            const validChr = inputChr.filter((c) => allowChrom.includes(c));
            f.CHR = dedupeKeepOrder(validChr);
        }
        if (BP_start) f.BP_start = Number(BP_start);
        if (BP_end) f.BP_end = Number(BP_end);
        if (P_min) f.P_min = Number(P_min);
        if (P_max) f.P_max = Number(P_max);
        if (rsID) f.rsID = rsID;

        setFilters(f);
        window.scrollTo({top: 0, behavior: "smooth"});
    };

    // 重置所有筛选条件
    const resetFilters = () => {
        setCHR("");
        setBPStart("");
        setBPEnd("");
        setPMin("");
        setPMax("");
        setRsID("");

        setChromOrder(defaultChromOrder);
        setChromOrderInput(defaultChromOrder.join(", "));
        setGap(3000000);
        setMarkerSize(4);

        // 重置显著性线配置
        setGenomewideP(5e-8);
        setSuggestiveP(1e-5);

        setFilters({});
        window.scrollTo({top: 0, behavior: "smooth"});
    };

    // 获取数据
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await getFilteredGwasDataByTrait(traitName, {limit: -1}, filters);
                setData(res.data || []);
            } catch (err) {
                console.error("获取筛选数据失败:", err);
            } finally {
                setLoading(false);
                if (isFirstLoadRef.current) isFirstLoadRef.current = false;
            }
        }

        fetchData();
    }, [traitName, filters]);

    // 处理 chromOrder 输入变化
    const handleChromOrderChange = (e) => {
        const value = e.target.value;
        setChromOrderInput(value);

        if (chromOrderInputTimerRef.current) {
            clearTimeout(chromOrderInputTimerRef.current);
        }

        chromOrderInputTimerRef.current = setTimeout(() => {
            const inputValues = getChrTokens(value).map(normalizeChrom);
            const validChroms = inputValues.filter((c) => allowChrom.includes(c));
            const uniqValid = dedupeKeepOrder(validChroms);
            setChromOrder(uniqValid);
            setGap(Math.max(1_000_000, Math.floor((uniqValid.length / 22) * 3_000_000)));
        }, 500);
    };

    return (<Box sx={{p: 1}}>
        {/* 标题和统计信息 */}
        <Box sx={{mb: 3}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 2}}>
                <ScienceIcon color="primary" sx={{fontSize: 32}}/>
                <Box>
                    <Typography variant="h4" fontWeight="700" color="primary.main">
                        {traitName}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Drag the top of the y-axis to zoom the chart, drag the middle to pan,
                        double-click the chart to reset, and use the toolbar to export an image or SVG.
                    </Typography>
                </Box>
            </Box>
            <StatsPanel
                data={data}
                loading={loading}
                genomewideP={genomewideP}
                suggestiveP={suggestiveP}
            />
        </Box>

        {/* 图表区 */}
        <Card
            elevation={1}
            sx={{
                position: "relative",
                minHeight: 600,
                borderRadius: 1,
                overflow: 'hidden',
                border: "1px solid rgba(25, 118, 210, 0.1)",
                background: 'white',
            }}
        >
            <CardContent sx={{p: 0, height: '100%'}}>
                <ManhattanPlot
                    data={data}
                    genomewideP={genomewideP}
                    suggestiveP={suggestiveP}
                    title={`${traitName} - Manhattan Plot`}
                    height="600px"
                    markerSize={markerSize}
                    chromOrder={chromOrder.length > 0 ? chromOrder : defaultChromOrder}
                    gap={gap}
                />

                <Fade in={loading} timeout={{enter: 200, exit: 350}} unmountOnExit>
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(255, 255, 255, 0.8)",
                            backdropFilter: "blur(4px)",
                            zIndex: 10,
                            borderRadius: 2,
                        }}
                    >
                        <Box sx={{textAlign: 'center'}}>
                            <CircularProgress
                                size={60}
                                thickness={4}
                                sx={{color: '#1976d2'}}
                            />
                            <Typography
                                variant="h6"
                                sx={{mt: 2, color: 'text.primary'}}
                            >
                                Loading the Manhattan data...
                            </Typography>
                        </Box>
                    </Box>
                </Fade>
            </CardContent>
        </Card>

        {/* 筛选面板 */}
        <FilterPanel
            CHR={CHR} setCHR={setCHR}
            BP_start={BP_start} setBPStart={setBPStart}
            BP_end={BP_end} setBPEnd={setBPEnd}
            P_min={P_min} setPMin={setPMin}
            P_max={P_max} setPMax={setPMax}
            rsID={rsID} setRsID={setRsID}
            onApply={applyFilters}
            onReset={resetFilters}
            hasChrValues={hasChrValues}
            onUseChrAsOrder={useChrAsChromOrder}
            chromOrderInput={chromOrderInput}
            onChromOrderChange={handleChromOrderChange}
            gap={gap}
            setGap={setGap}
            markerSize={markerSize}
            setMarkerSize={setMarkerSize}
            genomewideP={genomewideP}
            setGenomewideP={setGenomewideP}
            suggestiveP={suggestiveP}
            setSuggestiveP={setSuggestiveP}
        />

        {/* 图例说明 */}
        <Alert
            severity="info"
            sx={{
                borderRadius: 2, '& .MuiAlert-message': {
                    width: '100%',
                }
            }}
        >
            <Typography variant="body2" fontWeight="600">
                Figure Legends:
            </Typography>
            <Box component="ul" sx={{mt: 1, mb: 0, pl: 2}}>
                <li>
                    <Typography variant="body2">
                        <strong>Genome-wide significance line ({genomewideP.toExponential(2)}):</strong> Points
                        above this line are considered genome-wide significant
                    </Typography>
                </li>
                <li>
                    <Typography variant="body2">
                        <strong>Suggestive significance line ({suggestiveP.toExponential(2)}):</strong> Points above
                        this line are considered suggestive significant
                    </Typography>
                </li>
                <li>
                    <Typography variant="body2">
                        Different chromosomes are distinguished by different colors, and support custom sorting and
                        spacing.
                    </Typography>
                </li>
            </Box>
        </Alert>
    </Box>);
}
