import { Alert, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { captionSx, panelSx, sectionTitleSx } from '../themeUtils';
import { PageFrame } from '../components/PageScaffold';

export default function Genes() {
    const theme = useTheme();

    return (
        <PageFrame maxWidth={940} compact>
            <Paper sx={panelSx(theme, { p: { xs: 2, md: 3 } })}>
                <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 1.2 })}>Genes</Typography>
                <Typography variant="body1" sx={captionSx(theme, { mb: 1.8 })}>
                    Gene-level lookup is not wired to a production data endpoint yet.
                </Typography>
                <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    Use Trait or Programs to inspect gene annotations from loaded analysis files.
                </Alert>
            </Paper>
        </PageFrame>
    );
}
