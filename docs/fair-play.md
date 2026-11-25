# Fair play

OPMAS is an opening reference and a post-game analysis tool, not a live-game assistant.

- The safety gate blocks the panel on any game page unless the game is confirmed finished (fail closed).
- `integrations` never returns moves for a game in progress; `api-server /game` answers 403 for them.
- Engine analysis is only offered for finished games.
- Do not add overlays, auto-move or live suggestions. Chess.com and Lichess prohibit engine assistance in live games.
