# Opening Master (OPMAS)

OPMAS is an open-source chess opening toolkit: a browser-first Opening Explorer, PGN opening detector, Chess.com/Lichess userscript, shared TypeScript packages, and an optional HTTP API.

## Website

The website is a static React + Vite application and is designed to run on GitHub Pages without a backend.

- Opening Explorer: search the opening database by name, ECO code, or moves. The JSON database is served as a separate static asset to keep the initial JavaScript bundle small.
- Opening profiles: inspect opening lines and replay moves on the board.
- PGN Analyzer: detect an opening from pasted PGN and replay the game.
- Local-first: core chess and opening detection run in the browser; the optional API is not required.
- Userscript: download the generated `opmas.user.js` from the website.

### GitHub Pages deployment

The project site URL is:

`https://vonguyenphong-kids11ages.github.io/OPMAS/`

The workflow at `.github/workflows/deploy-pages.yml` builds the website and userscript, then deploys `apps/website/dist` whenever a commit reaches `main`.

One-time setup:

1. Open **Settings → Pages** in the repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Merge the website deployment changes into `main`. Subsequent pushes to `main` deploy automatically.

The Vite base path is configured as `/OPMAS/`; keep this in sync if the repository name changes.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/website` | Static React + Vite website for GitHub Pages |
| `apps/userscript` | Chess.com and Lichess userscript |
| `apps/api-server` | Optional HTTP API: `/health`, `/openings`, `/detect`, `/game` |
| `apps/desktop` | Planned desktop app |
| `packages/*` | Shared chess-core, PGN parser, opening database/detector, localization, safety gate, integrations, and UI components |
| `tools/*` | Database builder, validators, converter, and benchmark |
| `data/`, `integrations/`, `docs/` | Opening data, source manifests, integration notes, architecture, and fair-play docs |

## Quick start

```bash
corepack enable && pnpm install
pnpm fetch:sources && pnpm build:db
pnpm test && pnpm validate
pnpm dev:web
```

Build the static website and userscript locally:

```bash
pnpm release:web
```

The website output is written to `apps/website/dist`.

See `docs/development.md`. Fair-play policy: `docs/fair-play.md`.
