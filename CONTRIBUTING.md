# Contributing

1. `pnpm install`, then `pnpm fetch:sources && pnpm build:db`.
2. Keep changes small; add a Vitest test in `tests/unit` for logic changes.
3. Before opening a PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm validate`.
4. New data sources must be added to `data/sources/sources.json` with a license (`pnpm validate` checks it).
5. Translations: edit `locales/*.json`; `localization-checker` compares them with `en.json`.
6. Features that assist live games are out of scope (see `docs/fair-play.md`).
