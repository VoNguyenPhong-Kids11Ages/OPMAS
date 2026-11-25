import { Chess } from 'chess.js';

export interface Ply {
  san: string;
  uci: string;
  fen: string;
  /** Position key: first 4 FEN fields. Equal for transpositions. */
  key: string;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function toPly(chess: Chess, m: { san: string; from: string; to: string; promotion?: string }): Ply {
  const fen = chess.fen();
  return { san: m.san, uci: m.from + m.to + (m.promotion ?? ''), fen, key: positionKey(fen) };
}

/** Replays SAN moves. Throws on the first illegal move (chess.js 1.x behaviour). */
export function replay(sans: string[], startFen?: string): Ply[] {
  const chess = startFen ? new Chess(startFen) : new Chess();
  return sans.map((s) => toPly(chess, chess.move(s)));
}

export function replayUci(ucis: string[], startFen?: string): Ply[] {
  const chess = startFen ? new Chess(startFen) : new Chess();
  return ucis.map((u) =>
    toPly(chess, chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })),
  );
}

export function tryReplay(sans: string[], startFen?: string): Ply[] | null {
  try {
    return replay(sans, startFen);
  } catch {
    return null;
  }
}

export function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

export function isGameOver(fen: string): boolean {
  return new Chess(fen).isGameOver();
}
