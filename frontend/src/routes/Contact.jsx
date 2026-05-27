import { Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { captionSx, panelSx, sectionTitleSx } from '../themeUtils';
import { PageFrame } from '../components/PageScaffold';

export default function Contact() {
    const theme = useTheme();

    return (
        <PageFrame maxWidth={680} compact>
            <Paper sx={panelSx(theme, { p: { xs: 2, md: 3 } })}>
                <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 1.2 })}>Contact</Typography>
                <Typography variant="body1" sx={captionSx(theme)}>
                    如有问题或建议，请联系项目维护者。
                </Typography>
            </Paper>
        </PageFrame>
    );
}
