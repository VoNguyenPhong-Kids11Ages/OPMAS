# Opening Master (OPMAS)

Multilingual chess opening library and PGN opening detector, as a userscript for Chess.com and Lichess, plus a website, an API server and shared packages.

| Path | Status |
| --- | --- |
| `apps/userscript` | Working skeleton (library, detector, safety gate, 6 languages) |
| `apps/website` | Working skeleton (Vite + React: home, tools page); post-game analysis prototype in `public/` |
| `apps/api-server` | Small HTTP API: `/health`, `/openings`, `/detect`, `/game` |
| `apps/desktop` | Planned |
| `packages/*` | Implemented: chess-core, pgn-parser, opening-database, opening-detector, localization, safety-gate, integrations, ui-components |
| `tools/*` | Implemented: database-builder and validators, converter, benchmark |
| `data/`, `integrations/`, `docs/` | Sources manifest, notes, architecture and fair-play docs |

## Quick start

```bash
corepack enable && pnpm install
pnpm fetch:sources && pnpm build:db
pnpm test && pnpm validate
pnpm dev:web
```

See `docs/development.md`. Fair-play policy: `docs/fair-play.md`.
