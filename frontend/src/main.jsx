import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SWRConfig } from 'swr';
import App from './App.jsx';
import theme from './theme.js';
import { createTtlCache } from './utils/cache';

const swrCacheProvider = () => createTtlCache({ maxEntries: 300 });

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SWRConfig
                value={{
                    provider: swrCacheProvider,
                    revalidateOnFocus: false,
                    revalidateOnReconnect: false,
                    dedupingInterval: 60 * 1000,
                }}
            >
                <App />
            </SWRConfig>
        </ThemeProvider>
    </React.StrictMode>
);
