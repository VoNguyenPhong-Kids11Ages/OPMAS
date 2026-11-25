import { describe, expect, it } from 'vitest';
import { OpeningDatabase, type Opening } from '../../packages/opening-database/src/index.ts';

const records: Opening[] = [
  { eco: 'C20', name: "King's Pawn Game", pgn: '1. e4 e5', moves: ['e4', 'e5'], key: 'key-1', ply: 2 },
  { eco: 'C50', name: 'Italian Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], key: 'key-2', ply: 5 },
  { eco: 'D00', name: 'Queen Pawn Game', pgn: '1. d4 d5', moves: ['d4', 'd5'], key: 'key-3', ply: 2 },
];

describe('OpeningDatabase', () => {
  const db = new OpeningDatabase(records);

  it('indexes exact positions', () => {
    expect(db.lookup('key-2')?.name).toBe('Italian Game');
    expect(db.lookup('missing')).toBeUndefined();
  });

  it('searches ECO, names and move strings with a result limit', () => {
    expect(db.search('italian').map((opening) => opening.eco)).toEqual(['C50']);
    expect(db.search('1. d4')).toHaveLength(1);
    expect(db.search('', 2)).toHaveLength(2);
  });

  it('filters by ECO family', () => {
    expect(db.byEco('c').map((opening) => opening.eco)).toEqual(['C20', 'C50']);
  });
});
