import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  server: {
    proxy: {
      '/api/v3': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        secure: false,
      },
      '/dmx/v1': {
        target: 'https://www.dmxapi.cn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dmx/, ''),
      },
      '/tts-api': {
        target: 'https://openspeech.bytedance.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tts-api/, ''),
      }
    }
  }
});