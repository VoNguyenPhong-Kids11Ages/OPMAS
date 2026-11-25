import { describe, expect, it } from 'vitest';
import { replay } from '../../packages/chess-core/src/index.ts';
import { OpeningDatabase, type Opening } from '../../packages/opening-database/src/index.ts';
import { detectOpening } from '../../packages/opening-detector/src/index.ts';

const make = (eco: string, name: string, pgn: string): Opening => {
  const moves = pgn.split(' ');
  const plies = replay(moves);
  return { eco, name, pgn, moves, key: plies.at(-1)!.key, ply: plies.length };
};
const db = new OpeningDatabase([
  make('C20', "King's Pawn Game", 'e4 e5'),
  make('C50', 'Italian Game', 'e4 e5 Nf3 Nc6 Bc4'),
  make('D02', 'London System', 'd4 d5 Nf3 Nf6 Bf4'),
]);

describe('detectOpening', () => {
  it('finds the exact opening', () => {
    expect(detectOpening(db, 'e4 e5 Nf3 Nc6 Bc4 Bc5'.split(' '))?.opening.name).toBe('Italian Game');
  });
  it('does not label a different 5th move as Italian Game', () => {
    expect(detectOpening(db, 'e4 e5 Nf3 Nc6 d3'.split(' '))?.opening.name).toBe("King's Pawn Game");
  });
  it('recognises transpositions', () => {
    expect(detectOpening(db, 'Nf3 d5 d4 Nf6 Bf4'.split(' '))?.opening.name).toBe('London System');
  });
  it('uses the PGN starting FEN when detecting custom-position games', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    const plies = replay(['Kf2'], fen);
    const customDb = new OpeningDatabase([{ eco: 'A00', name: 'Custom FEN Test', pgn: 'Kf2', moves: ['Kf2'], key: plies[0]!.key, ply: 1 }]);
    expect(detectOpening(customDb, ['Kf2'], fen)?.opening.name).toBe('Custom FEN Test');
  });

  it('returns null for illegal input', () => {
    expect(detectOpening(db, ['e5'])).toBeNull();
  });
});
