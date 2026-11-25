import { replayUci } from '@opmas/chess-core';
import type { GameRef, GameStatus } from '@opmas/safety-gate';

/** Moves are only ever returned for finished games. */
export interface RemoteGame {
  status: GameStatus;
  sans?: string[];
  uci?: string[];
  startFen?: string;
}
type Fetch = typeof fetch;

// ---- Lichess (official API) ----
export async function fetchLichessGame(id: string, f: Fetch = fetch): Promise<RemoteGame> {
  const r = await f(`https://lichess.org/game/export/${id}?clocks=false&evals=false&opening=false`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) return { status: 'unknown' };
  const j = (await r.json()) as { status?: string; moves?: string; initialFen?: string; variant?: string };
  if (!j.status) return { status: 'unknown' };
  if (j.variant && j.variant !== 'standard') return { status: 'unknown' };
  if (j.status === 'created' || j.status === 'started') return { status: 'in-progress' };

  // Only explicitly recognized terminal statuses may pass the safety gate.
  // Aborted/noStart and future API statuses remain unknown (fail-closed).
  const finishedStatuses = new Set([
    'mate', 'resign', 'stalemate', 'timeout', 'draw', 'outoftime',
    'cheat', 'unknownFinish', 'variantEnd',
  ]);
  if (!finishedStatuses.has(j.status)) return { status: 'unknown' };

  return { status: 'finished', sans: (j.moves ?? '').split(' ').filter(Boolean), startFen: j.initialFen };
}

// ---- Chess.com (UNOFFICIAL callback endpoint; reverse-engineered, may change or block) ----
const CC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=';

export function decodeChesscomMoves(s: string): string[] {
  const sq = (i: number) => 'abcdefgh'[i % 8]! + (Math.floor(i / 8) + 1);
  const out: string[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const from = CC.indexOf(s[i]!);
    let to = CC.indexOf(s[i + 1]!);
    let promo = '';
    if (to > 63) {
      promo = 'qnrbkp'[Math.floor((to - 64) / 3)]!;
      to = from + (from < 16 ? -8 : 8) + ((to - 1) % 3) - 1;
    }
    out.push(sq(from) + sq(to) + promo);
  }
  return out;
}

export async function fetchChesscomGame(
  kind: 'live' | 'daily',
  id: string,
  f: Fetch = fetch,
): Promise<RemoteGame> {
  const r = await f(`https://www.chess.com/callback/${kind}/game/${id}`);
  if (!r.ok) return { status: 'unknown' };
  const g =
    ((await r.json()) as {
      game?: { isFinished?: boolean; moveList?: string; pgnHeaders?: Record<string, string> };
    }).game ?? {};
  const result = g.pgnHeaders?.['Result'];
  const validResults = new Set(['1-0', '0-1', '1/2-1/2']);
  const hasFinishedResult = typeof result === 'string' && validResults.has(result);
  const finished = g.isFinished === true || hasFinishedResult;
  if (!finished) return { status: g.isFinished === false ? 'in-progress' : 'unknown' };
  return { status: 'finished', uci: decodeChesscomMoves(g.moveList ?? ''), startFen: g.pgnHeaders?.['FEN'] };
}

// ---- Dispatch ----
export function fetchGame(ref: GameRef, f: Fetch = fetch): Promise<RemoteGame> {
  return ref.site === 'lichess'
    ? fetchLichessGame(ref.id, f)
    : fetchChesscomGame(ref.kind ?? 'live', ref.id, f);
}

export async function fetchStatus(ref: GameRef): Promise<GameStatus> {
  return (await fetchGame(ref)).status;
}

export function gameToSans(g: RemoteGame): string[] {
  if (g.sans) return g.sans;
  return g.uci ? replayUci(g.uci, g.startFen).map((p) => p.san) : [];
}
