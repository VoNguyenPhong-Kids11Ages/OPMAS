# OPMAS Userscript

Tampermonkey userscript for Chess.com and Lichess, built with Vite and `vite-plugin-monkey`.

## Features

- Pixel-style OPMAS knight identity and floating launcher.
- Tampermonkey commands: Open Explorer, Analyze PGN, Saved openings, Close GUI.
- Opening Explorer searches ECO, opening names, and move strings across the bundled database.
- ECO family filter (A–E), opening detail view, copy moves/ECO actions.
- Local saved-opening list using browser localStorage.
- PGN Analyzer detects the deepest matching opening position and reports matched ply, parsed move count, and game result.
- Language selector using the shared localization package.
- Safety gate remains active on game pages; the userscript does not provide live-game move assistance.

## Development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build:userscript
```

Build output: `apps/userscript/dist/opmas.user.js`.

The generated `dist/` directory is intentionally ignored by Git. CI uploads the built script as the `opmas-userscript` artifact. The website release workflow also copies it into `apps/website/public/opmas.user.js`.

## Install

1. Build the userscript locally or download the CI artifact.
2. Open the generated `opmas.user.js` in a browser with Tampermonkey installed.
3. Confirm installation, then open Chess.com or Lichess.
4. Use the floating OPMAS launcher or Tampermonkey's OPMAS menu commands.

## Storage

- `opmas-language`: selected UI language.
- `opmas-favorites-v1`: saved ECO codes.
- `opmas-safety-v1`: current-session safety confirmation.
