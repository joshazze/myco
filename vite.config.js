import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/myco/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
