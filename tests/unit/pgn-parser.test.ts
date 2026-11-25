import { describe, expect, it } from 'vitest';
import { parsePgn } from '../../packages/pgn-parser/src/index.ts';

describe('parsePgn', () => {
  it('reads headers, strips comments, NAGs and nested variations', () => {
    const r = parsePgn(
      '[Event "Test"]\n[Result "1-0"]\n\n1. e4 e5 {comment} 2. Nf3 (2. f4 exf4 (2... d5)) Nc6 $1 3. Bb5 a6!? 1-0',
    );
    expect(r.headers['Event']).toBe('Test');
    expect(r.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    expect(r.result).toBe('1-0');
  });

  it('normalises 0-0 castling and ignores junk text', () => {
    expect(parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0 dad4 hello').moves.at(-1)).toBe('O-O');
  });

  it('reads a custom starting FEN and escaped header values', () => {
    const r = parsePgn('[Event "A \\"quoted\\" event"]\n[SetUp "1"]\n[FEN "8/8/8/8/8/8/4k3/4K3 w - - 0 1"]\n[Result "*"]\n\n1. Kf2 *');
    expect(r.headers['Event']).toBe('A "quoted" event');
    expect(r.headers['FEN']).toBe('8/8/8/8/8/8/4k3/4K3 w - - 0 1');
    expect(r.moves).toEqual(['Kf2']);
  });
});
