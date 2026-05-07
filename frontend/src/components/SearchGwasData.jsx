import React, {useEffect, useState} from "react";
import {InputAdornment, TextField} from "@mui/material";
import {Search as SearchIcon} from "@mui/icons-material";

function SearchFilter({onSearch}) {
    const [searchTerm, setSearchTerm] = useState('');

    // 防抖处理，避免频繁触发搜索请求
    // 设置300ms延迟，用户停止输入后才触发搜索
    useEffect(() => {
        const handler = setTimeout(() => {
            onSearch(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, onSearch]);

    return (
        <TextField
            fullWidth
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action"/>
                        </InputAdornment>
                    ),
                }
            }}
            sx={{
                maxWidth: 300,
                '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'background.paper',
                }
            }}
        />
    );
}

export default SearchFilter;
