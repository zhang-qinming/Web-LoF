import { Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { captionSx, panelSx, sectionTitleSx } from '../themeUtils';
import { PageFrame } from '../components/PageScaffold';

export default function About() {
    const theme = useTheme();

    return (
        <PageFrame maxWidth={820} compact>
            <Paper sx={panelSx(theme, { p: { xs: 2, md: 3 } })}>
                <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 1.2 })}>About</Typography>
                <Typography variant="body1" sx={captionSx(theme, { lineHeight: 1.75 })}>
                    GWAS Data Browser provides trait-level association browsing, program enrichment views, and downloadable analysis outputs for the project data bundle.
                </Typography>
            </Paper>
        </PageFrame>
    );
}
