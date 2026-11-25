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
- Safety gate disables the Explorer and PGN tools on active play pages. No live-game move suggestions or engine assistance.

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
