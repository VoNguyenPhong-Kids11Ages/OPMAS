# Data sources

| Source | License (per upstream, verify) | Use |
| --- | --- | --- |
| lichess-org/chess-openings | CC0-1.0 | Opening names, ECO, PGN |
| chess.js | BSD-2-Clause | Rules, SAN/FEN |
| Lichess API | Service terms | Finished-game export; opening explorer needs a check of auth and rate limits |
| PgnViewerJS / pgn-viewer | UNVERIFIED | Optional viewer. The notes this repo was specified from list one repository owner and one license; confirm the canonical repo and license first |

Keep GPL/AGPL code out of this repository unless the repo itself is relicensed. `pnpm validate` fails on copyleft entries in `sources.json`.
