import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@chessbutfree/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
