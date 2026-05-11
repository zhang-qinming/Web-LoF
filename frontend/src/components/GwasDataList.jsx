// components/GwasDataList.jsx
/**
 * GWAS数据列表组件
 *
 * 功能特点:
 * - 支持服务端分页、排序和搜索
 * - 自动处理空状态和错误状态
 * - 响应式设计，适配不同屏幕尺寸
 * - 优化的加载状态（仅覆盖表格区域）
 * - 可配置的列显示和数据源
 *
 * 使用场景:
 * - 显示所有GWAS数据的浏览页面
 * - 显示特定性状的GWAS数据详情
 *
 * Props:
 * - title: 组件标题
 * - columns: 表格列配置
 * - traitName: 特定性状名称（可选）
 * - defaultSortBy: 默认排序字段
 * - defaultOrder: 默认排序顺序
 */

import React, {useState, useEffect, useCallback} from "react";
import useSWR from "swr";
import {Link as RouterLink} from "react-router-dom";
import {fetcher} from "../api/gwas";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, FormControl, Select, MenuItem,
    Box, Typography, Pagination, CircularProgress, TableSortLabel, Link, TextField,
    Chip, Card, CardContent, Alert, Button,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

// 分页控制组件 - 用于显示分页导航
function PaginationControl({totalPages, page, onChange}) {
    // 如果总页数为0或1，不显示分页控件
    if (totalPages <= 1) return null;

    return (<Box sx={{display: "flex", justifyContent: "center", alignItems: "center"}}>
        <Pagination
            count={totalPages}
            page={page}
            onChange={onChange}
            color="primary"
            shape="rounded"
            size="medium"
            showFirstButton
            showLastButton
        />
    </Box>);
}

// 跳转页面控制组件 - 允许用户直接跳转到指定页码
function JumpToPageControl({totalPages, page, onChange}) {
    const [inputPage, setInputPage] = useState(page);

    const isValid = inputPage !== '' && Number(inputPage) >= 1 && Number(inputPage) <= totalPages;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isValid) {
            onChange(null, Number(inputPage));
        }
    };

    // 处理输入框失去焦点时的自动修正
    const handleBlur = () => {
        const value = inputPage;

        // 如果输入为空，恢复为当前页码
        if (value === '') {
            setInputPage(page);
            return;
        }

        const numValue = Number(value);

        // 如果不是有效数字，恢复为当前页码
        if (isNaN(numValue)) {
            setInputPage(page);
            return;
        }

        // 自动修正超出范围的值
        if (numValue < 1) {
            setInputPage(1);
        } else if (numValue > totalPages) {
            setInputPage(totalPages);
        }
    };

    useEffect(() => {
        setInputPage(page);
    }, [page]);

    if (totalPages <= 1) return null;

    return (<Box component="form" onSubmit={handleSubmit} sx={{display: "flex", alignItems: "center", gap: 2}}>
        <Typography variant="body2" color="text.secondary" sx={{whiteSpace: "nowrap"}}>
            Jump to
        </Typography>
        <TextField
            size="small"
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            onBlur={handleBlur}
            type="number"
            slotProps={{
                input: {
                    min: 1, max: totalPages, style: {textAlign: 'center', width: 100}
                },
            }}
        />
        <Button
            type="submit"
            variant="outlined"
            size="small"
            startIcon={<SendIcon/>}
            disabled={!isValid}
            sx={{
                textTransform: "none",
                minWidth: 0,
                width: {xs: "100%", sm: "auto"},
                height: 40,
                px: 1.5,
                fontSize: 13,
            }}
        >
            Confirm
        </Button>
    </Box>);
}


// 数据行组件 - 显示单行GWAS数据
function TraitRow({row, index, columns}) {
    return (<TableRow
        sx={{
            backgroundColor: index % 2 === 0 ? 'rgba(25, 118, 210, 0.02)' : 'white',
            transition: 'all 0.1s ease-in-out',
            '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            },
            '& td': {
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)', py: 1.5, // 减小行高以提高信息密度
                fontSize: '0.875rem',
            },
        }}
    >
        {columns.map((col) => (<TableCell key={col.id} align={col.numeric ? "right" : "left"}>
            {col.id === 'trait_name' ? (
                <Link component={RouterLink} to={`/trait/${encodeURIComponent(row.file_id)}`}
                    underline="hover"
                    sx={{ color: '#2563eb', fontWeight: 500, fontSize: '0.85rem' }}>
                    {String(row[col.id] || '').replace(/^["']+|["']+$/g, '')}
                </Link>) : col.id === 'Sample Size' ? (// Sample Size列显示为Chip组件，格式化数字
                <Chip
                    label={row[col.id]?.toLocaleString() || "-"}
                    size="small"
                    color="primary"
                    variant="outlined"
                />) : (// 其他列显示原始数据或"-"
                row[col.id] || "-")}
        </TableCell>))}
    </TableRow>);
}

// 加载骨架屏 - 在数据加载时显示占位符
function LoadingSkeleton({rows = 10, columns}) {
    return (<>
        {Array.from(new Array(rows)).map((_, index) => (<TableRow key={index}>
            {columns.map((col) => (<TableCell key={col.id}>
                <Box
                    sx={{
                        height: 16, // 减小骨架屏高度
                        backgroundColor: 'grey.100',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        '@keyframes pulse': {
                            '0%': {opacity: 1}, '50%': {opacity: 0.4}, '100%': {opacity: 1},
                        },
                    }}
                />
            </TableCell>))}
        </TableRow>))}
    </>);
}

// 主组件
export default function GwasDataList({
                                         title = "GWAS Data",
                                         columns = [],
                                         traitName = null,
                                         defaultSortBy = "Trait",
                                         defaultOrder = "ASC",
                                     }) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10); // 默认显示10条
    const [sortBy, setSortBy] = useState(defaultSortBy);
    const [order, setOrder] = useState(defaultOrder);

    // 构造API URL - 根据是否有traitName决定使用哪种API
    const apiUrl = traitName ? `/api/trait/${encodeURIComponent(traitName)}?page=${page}&limit=${limit}&sortBy=${sortBy}&order=${order}` : `/api/browse?page=${page}&limit=${limit}&sortBy=${sortBy}&order=${order}`;

    // 使用SWR获取数据，启用缓存和自动重新验证
    const {data, error, isLoading} = useSWR(apiUrl, fetcher, {
        keepPreviousData: true, // 保持上一次数据以提供平滑过渡
        revalidateOnFocus: false, // 禁用焦点重新验证以减少请求
        revalidateOnReconnect: false, revalidateIfStale: false, refreshInterval: 0, shouldRetryOnError: false,
    });

// 刷新数据
    // 处理排序 - 重置到第一页
    const handleSort = useCallback((column) => {
        const isAsc = sortBy === column && order === "ASC";
        setOrder(isAsc ? "DESC" : "ASC");
        setSortBy(column);
        setPage(1);
    }, [sortBy, order]);

// 改变每页显示数量 - 重置到第一页
    const handleChangeLimit = useCallback((e) => {
        const newLimit = Number(e.target.value);
        // 限制每页显示数量在合理范围内
        if (newLimit >= 5 && newLimit <= 100) {
            setLimit(newLimit);
            setPage(1);
        }
    }, []);

    const rows = data?.data || [];
    const totalPages = data?.totalPages || 1;
    const totalCount = data?.totalCount || 0;

// 当总页数变化且当前页超出范围时，调整到有效页面
    useEffect(() => {
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

// 错误状态处理
    if (error) {
        return (<Alert severity="error" sx={{m: 2}}>
            Data loading failed: {error.message}
        </Alert>);
    }

    return (<Box sx={{position: 'relative'}}>
        <Card elevation={0} sx={{
            border: '1px solid rgba(0,0,0,.06)', borderRadius: 2, overflow: 'hidden',
        }}>
            {/* 分页控制栏 */}
            <Box sx={{
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                bgcolor: '#fafbfc', borderBottom: '1px solid #eef0f2',
            }}>
                {/* 左: Per page */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        Per page
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 70 }}>
                        <Select value={limit} onChange={handleChangeLimit}
                            sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.6 } }}>
                            {[5, 10, 20, 50, 100].map(v => (
                                <MenuItem key={v} value={v} dense>{v}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* 中: Total */}
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {totalCount.toLocaleString()} records
                </Typography>

                {/* 中右: 页码 */}
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <PaginationControl
                        totalPages={totalPages}
                        page={page}
                        onChange={(e, value) => setPage(value)}
                    />
                </Box>

                {/* 右: 跳转 */}
                <JumpToPageControl
                    totalPages={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                />
            </Box>

            <CardContent sx={{p: 0}}>

                {/* 表格容器 - 固定高度以防止loading时高度跳动 */}
                <Box sx={{
                    position: 'relative', // 设置最小高度防止内容跳动
                }}>
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{
                            border: '1px solid rgba(0,0,0,.06)', borderRadius: 2, maxHeight: 600,
                            overflow: 'auto',
                        }}
                    >
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {columns.map(({id, label, numeric}) => (<TableCell
                                        key={id}
                                        align={numeric ? 'right' : 'left'}
                                        sx={{
                                            background: '#f8f9fb',
                                            color: '#444',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.03em',
                                            textTransform: 'uppercase',
                                            borderBottom: '2px solid #e8eaed',
                                            py: 1.2,
                                        }}
                                    >
                                        <TableSortLabel
                                            active={sortBy === id}
                                            direction={sortBy === id ? order.toLowerCase() : 'asc'}
                                            onClick={() => handleSort(id)}
                                            sx={{
                                                color: 'inherit',
                                                '&:hover': { color: '#2563eb' },
                                                '&.Mui-active': { color: '#2563eb', fontWeight: 700 },
                                                '& .MuiTableSortLabel-icon': { color: '#2563eb !important' },
                                            }}
                                        >
                                            {label}
                                        </TableSortLabel>
                                    </TableCell>))}
                                </TableRow>
                            </TableHead>

                            {/* 表格主体内容 */}
                            <TableBody>
                                {isLoading ? (// 加载时显示骨架屏
                                    <LoadingSkeleton columns={columns}
                                                     rows={Math.min(limit, 10)}/>) : (// 数据加载完成后显示实际数据
                                    <>
                                        {rows.map((row, index) => (<TraitRow
                                            key={row.id || index}
                                            row={row}
                                            index={index}
                                            columns={columns}
                                        />))}
                                    </>)}
                            </TableBody>
                        </Table>

                        {/* 空状态处理 */}
                        {!isLoading && rows.length === 0 && (<Box sx={{
                            p: 8, textAlign: 'center', color: 'text.secondary', minHeight: 300, // 保持最小高度
                        }}>
                            <Typography variant="h6" gutterBottom>
                                No data available
                            </Typography>
                        </Box>)}
                    </TableContainer>

                    {/* 局部加载遮罩 - 仅覆盖表格区域，避免整个组件高度跳动 */}
                    {isLoading && (<Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(255, 255, 255, 0.7)",
                            backdropFilter: "blur(2px)", // 添加高斯模糊效果
                            zIndex: 10,
                        }}
                    >
                        <Box sx={{textAlign: 'center'}}>
                            <CircularProgress
                                color="primary"
                                size={50}
                                thickness={4}
                            />
                            <Typography
                                variant="body2"
                                sx={{mt: 1, color: 'text.primary'}}
                            >
                                Loading...
                            </Typography>
                        </Box>
                    </Box>)}
                </Box>

                {/* 底部控制栏 */}
                {rows.length > 0 && (<Box sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    background: 'rgba(245, 245, 245, 0.5)',
                    borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                }}>
                    <Typography variant="body2" color="text.secondary">
                        {totalCount === 0 ? "No items" : `Showing ${Math.min(((page - 1) * limit) + 1, totalCount)} - ${Math.min(page * limit, totalCount)} of ${totalCount} records`}
                    </Typography>

                    <PaginationControl
                        totalPages={totalPages}
                        page={page}
                        onChange={(e, value) => setPage(value)}
                    />
                </Box>)}
            </CardContent>
        </Card>
    </Box>);
}