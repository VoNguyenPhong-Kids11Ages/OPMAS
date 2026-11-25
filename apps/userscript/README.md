# apps/userscript (OPMAS)

Vite + `vite-plugin-monkey` build of the userscript. Output: `dist/opmas.user.js`.

- `src/main.ts` is a thin UI on top of the `packages/*` libraries (detector, localization, safety gate).
- Drop the old single-file script (Opening Master 1.2.0) into `legacy/` for reference while porting the remaining UI.
- The userscript runs on chess.com / lichess.org, so game-status checks are same-origin (no CORS issue).
