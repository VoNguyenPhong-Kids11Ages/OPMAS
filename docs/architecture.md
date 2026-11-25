# Architecture

```
data/sources (CC0 TSV) --database-builder--> data/openings/openings.json
                                                   |
   packages: pgn-parser -> chess-core -> opening-database -> opening-detector
                                                   |
   apps: userscript (OPMAS) | website | api-server | desktop (planned)
   packages: safety-gate + integrations gate every game-related feature
```

- Detection is position-based (FEN key), so transpositions work and partial prefixes do not mislabel games.
- Packages are consumed as TypeScript source (`exports` -> `src/index.ts`); only apps have a build step.
- `/integrations` (root) holds notes and fixtures per source; `packages/integrations` holds the code.
