# OPMAS Userscript

OPMAS is a study-first chess opening companion for Chess.com and Lichess, built with Vite and `vite-plugin-monkey`.

## Features

- Light, responsive floating interface isolated in Shadow DOM.
- Opening Explorer for the bundled opening database: search by ECO, name, or moves; filter ECO families; progressively load results.
- Interactive board replay for opening main lines, with start/previous/next/end controls.
- PGN Analyzer identifies the deepest matching opening position and reports the matched ply and game result.
- Favorites stored locally by ECO code, with migration from the previous storage format.
- Vietnamese-first interface with the shared language selector.
- Tampermonkey menu commands and keyboard Escape to close.
- Defensive mount recovery for pages that replace their DOM.
- Read-only Live Opening Detector for supported Lichess game URLs and Chess.com live/play pages: observes the visible move list, identifies the deepest matching opening/variation, tracks moves beyond the matched theory line, and updates as the game progresses.
- Strict live-play boundary: no engine, best-move hints, move recommendations, board clicks, premoves, or move submission. Explorer and PGN analysis remain unavailable while a game is active.
- Live detector reads only the supported site's visible move-list DOM; selector changes by either site may temporarily prevent detection until the adapter is updated.

## Live detection limitations\n\nThe live adapter is DOM-based and intentionally read-only. It does not request private game data or interact with the board. Lichess and Chess.com may change their page markup; if the move list cannot be read, OPMAS displays a waiting state rather than guessing. The opening label is only as precise as the bundled database and the moves visible on the page.\n\n## Development

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
