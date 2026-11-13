import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  optimizeDeps: {
    include: ['@botprogracraft/shared'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/shared/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
