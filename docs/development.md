# Development

```bash
corepack enable && pnpm install
pnpm fetch:sources && pnpm build:db   # openings.json starts as []
pnpm test
pnpm dev:web
pnpm build:userscript                 # apps/userscript/dist/opmas.user.js
pnpm release:web                      # builds the userscript, copies it into the website, builds the site
```

Termux: Node and pnpm work (`pkg install nodejs`, then `corepack enable`). Playwright cannot download browsers on Android, so run `pnpm test:e2e` on a desktop or let GitHub Actions do it.
