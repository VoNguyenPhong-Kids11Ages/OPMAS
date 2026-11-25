import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'OPMAS',
        namespace: 'opmas',
        version: '2.0.0',
        description: 'Opening Master: multilingual opening library and PGN opening detector',
        match: ['https://www.chess.com/*', 'https://lichess.org/*'],
        'run-at': 'document-idle',
      },
      build: { fileName: 'opmas.user.js' },
    }),
  ],
});
