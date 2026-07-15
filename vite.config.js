import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://studio-api.prod.suno.com',
        changeOrigin: true,
        headers: {
          'Origin': 'https://suno.com',
          'Referer': 'https://suno.com/'
        }
      }
    }
  }
});
