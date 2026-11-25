import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'OPMAS — Opening Master',
        namespace: 'opmas',
        version: '2.3.0',
        description: 'Opening explorer, PGN analysis, favorites and read-only live opening variation detection',
        icon: 'https://raw.githubusercontent.com/VoNguyenPhong-Kids11Ages/OPMAS/feat/light-opening-explorer/apps/userscript/public/opmas-icon.svg',
        match: ['https://www.chess.com/*', 'https://lichess.org/*'],
        grant: ['GM_registerMenuCommand'],
        'run-at': 'document-idle',
      },
      build: { fileName: 'opmas.user.js' },
    }),
  ],
});
