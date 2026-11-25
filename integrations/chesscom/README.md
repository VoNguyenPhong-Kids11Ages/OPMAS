# Chess.com

- Official: Published-Data API `https://api.chess.com/pub/...` (player archives; no lookup by game id).
- Unofficial: `https://www.chess.com/callback/{live|daily}/game/{id}` is used for game status and moves. It is reverse-engineered, can change, and may block cross-origin requests from a website. From the userscript (same origin) it is a plain fetch.
- The move list is a custom encoding; the decoder lives in `packages/integrations` and has not been verified against live data.
