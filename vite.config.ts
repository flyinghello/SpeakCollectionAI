import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    // Polyfill process.env for local development compatibility
    'process.env': process.env
  },
  server: {
    proxy: {
      // Proxy requests starting with /api/v3 to the Volcengine API
      '/api/v3': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        secure: false, // Accept self-signed certs if any
      }
    }
  }
});
