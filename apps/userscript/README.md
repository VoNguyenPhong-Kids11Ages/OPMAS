# OPMAS Userscript

OPMAS is a study-first chess opening companion for Chess.com and Lichess, built with Vite and `vite-plugin-monkey`.

## Features

- Light, responsive floating interface isolated in Shadow DOM, with a responsive green board and bundled Chessnut SVG pieces.
- Opening Explorer for the bundled opening database: search by ECO, name, or moves; filter ECO families; progressively load results.
- Interactive board replay for opening main lines, with start/previous/next/end controls.
- PGN Analyzer identifies the deepest matching opening position and reports the matched ply and game result.
- Favorites stored locally by ECO code, with migration from the previous storage format.
- Vietnamese-first interface with the shared language selector.
- Tampermonkey menu commands and keyboard Escape to close.
- Defensive mount recovery for pages that replace their DOM.
- Live board mirroring on supported Lichess and Chess.com game/play routes: reads the visible move list, replays the current game position on the OPMAS board, and updates on DOM changes with a debounced observer plus a short fallback poll.
- Live Opening Detector identifies the opening/ECO and deepest matching variation, shows moves beyond the theory line, and marks `OPENING PHASE COMPLETED` on the synchronized board when the recorded theory line has been passed.
- Both supported sites auto-open the read-only detector when a live game/play route is recognized. Chess.com DOM selectors are defensive and may need updates when its UI changes.
- Strict live-play boundary: no engine, best-move hints, move recommendations, board clicks, premoves, or move submission. Explorer and PGN analysis remain unavailable while a game is active.
- Live detector reads only the supported site's visible move-list DOM; selector changes by either site may temporarily prevent detection until the adapter is updated.

## Live detection limitations

The live adapter is DOM-based and intentionally read-only. It does not request private game data or interact with the board. Lichess and Chess.com may change their page markup; if a move list is temporarily incomplete, OPMAS retries after subsequent DOM updates and through a short fallback poll instead of permanently caching the partial sequence. The opening label is only as precise as the bundled database and the moves visible on the page.

## Piece artwork

The board bundles the Chessnut SVG chess-piece set by Alexis Luengas, used under Apache License 2.0. See `src/chessnut-pieces.ts`, `NOTICE-CHESSNUT.md`, and `LICENSE-CHESSNUT.txt`. OPMAS does not copy Chess.com-owned piece artwork or imply endorsement by Chess.com.

## Development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build:userscript
```

Build output: `apps/userscript/dist/opmas.user.js`.

The generated `dist/` directory is intentionally not committed. CI uploads the built script as the `opmas-userscript` artifact, and the website release script copies it to `apps/website/public/opmas.user.js`.

## Install

1. Build the userscript locally or download the latest successful CI artifact.
2. Open `opmas.user.js` in a browser with Tampermonkey installed.
3. Confirm installation, then visit Chess.com or Lichess.
4. Open OPMAS from the floating launcher or the Tampermonkey menu.

## Local storage

- `opmas-language`: selected language.
- `opmas-favorites-v2`: saved ECO codes.
- `opmas-safety-v2`: study-use confirmation for the current browser storage.

The older `opmas-favorites-v1` list is migrated when possible.
