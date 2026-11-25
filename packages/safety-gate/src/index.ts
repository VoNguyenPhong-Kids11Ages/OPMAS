export type Site = 'lichess' | 'chesscom';
export interface GameRef {
  site: Site;
  id: string;
  kind?: 'live' | 'daily';
}
export type GameStatus = 'finished' | 'in-progress' | 'unknown';
export type GateDecision =
  | { allowed: true }
  | { allowed: false; reason: 'game-in-progress' | 'status-unknown' };

const LICHESS_RESERVED = new Set([
  'analysis', 'practice', 'training', 'tutorial', 'insights', 'settings', 'features', 'overview',
]);

function parts(url: string): { host: string; path: string[] } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname.replace(/^www\./, ''), path: u.pathname.split('/').filter(Boolean) };
  } catch {
    return null;
  }
}

export function parseGameUrl(url: string): GameRef | null {
  const p = parts(url);
  if (!p) return null;
  if (p.host === 'lichess.org') {
    const [first, second] = p.path;
    if (!first || p.path.length > 2 || !/^[A-Za-z0-9]{8}([A-Za-z0-9]{4})?$/.test(first)) return null;
    if (LICHESS_RESERVED.has(first.toLowerCase())) return null;
    if (second && second !== 'white' && second !== 'black') return null;
    return { site: 'lichess', id: first.slice(0, 8) };
  }
  if (p.host === 'chess.com') {
    const m = p.path.join('/').match(/(?:^|\/)(live|daily)\/(?:game\/)?(\d+)$/);
    return m ? { site: 'chesscom', kind: m[1] as 'live' | 'daily', id: m[2]! } : null;
  }
  return null;
}

/** Pages where a game can be in progress but carry no game id (e.g. chess.com /play/online). */
export function isPlayContext(url: string): boolean {
  const p = parts(url);
  return !!p && p.host === 'chess.com' && p.path[0] === 'play';
}

/**
 * Fail-closed gate. Non-game pages are allowed. On a game page the game must be positively
 * confirmed as finished; an unknown status blocks.
 */
export async function checkGate(
  url: string,
  fetchStatus: (ref: GameRef) => Promise<GameStatus>,
): Promise<GateDecision> {
  if (isPlayContext(url)) return { allowed: false, reason: 'game-in-progress' };
  const ref = parseGameUrl(url);
  if (!ref) return { allowed: true };
  let status: GameStatus;
  try {
    status = await fetchStatus(ref);
  } catch {
    status = 'unknown';
  }
  if (status === 'finished') return { allowed: true };
  return { allowed: false, reason: status === 'in-progress' ? 'game-in-progress' : 'status-unknown' };
}
