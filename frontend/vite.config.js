import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    plugins: [react()],
    server: {
        host: process.env.VITE_HOST || 'localhost',
        port: parseInt(process.env.VITE_PORT) || 5173,
        proxy: {
            '/api': {
                target: `http://${process.env.VITE_API_HOST || 'localhost'}:${process.env.VITE_API_PORT || '4000'}`,
                changeOrigin: true,
            },
        },
    },
});
