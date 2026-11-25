import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/OPMAS/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react-dom';
          if (id.includes('/react/')) return 'vendor-react';
          if (id.includes('/chess.js/')) return 'vendor-chess';
          return undefined;
        },
      },
    },
  },
});
