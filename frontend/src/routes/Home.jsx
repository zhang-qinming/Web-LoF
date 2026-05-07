import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { FaListAlt, FaFolderOpen } from 'react-icons/fa';

export default function Home() {
    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
            <Typography variant="h4" gutterBottom>
                GWAS Data Browser
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                全基因组关联分析 (GWAS) 数据浏览与可视化平台
            </Typography>

            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Card sx={{ flex: '1 1 300px' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <FaListAlt style={{ marginRight: 8 }} />
                            Trait 浏览
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            浏览所有 GWAS Trait 元数据，查看样本量、变异位点等统计信息
                        </Typography>
                        <Button component={RouterLink} to="/browse" variant="contained" size="small">
                            进入浏览
                        </Button>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 300px' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <FaFolderOpen style={{ marginRight: 8 }} />
                            Trait 详情
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            查看特定 Trait 的曼哈顿图与关联 SNP 数据
                        </Typography>
                        <Button component={RouterLink} to="/trait" variant="contained" size="small">
                            查看详情
                        </Button>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
