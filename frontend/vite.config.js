import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy API + static asset paths to the Flask/Express backend on :4000,
// so the frontend can use same-origin relative URLs everywhere.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/images': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
