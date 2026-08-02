import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.UI_HOST || '127.0.0.1',
    port: Number(process.env.UI_PORT || 4510),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || 5510}` },
  },
  preview: { host: process.env.UI_HOST || '127.0.0.1' },
});
