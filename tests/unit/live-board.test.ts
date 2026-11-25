import { describe, expect, it } from 'vitest';
import { parseSanTokens, readLiveMoves } from '../../apps/userscript/src/live-board';

describe('live move-list parser', () => {
  it('extracts SAN while ignoring move numbers, clocks and result markers', () => {
    expect(parseSanTokens('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0'))
      .toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6']);
  });

  it('handles black move numbers, castling and check suffixes', () => {
    expect(parseSanTokens('1... c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6+ 5. O-O'))
      .toEqual(['c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6+', 'O-O']);
  });

  it('handles castling check suffixes, disambiguation and promotion', () => {
    expect(parseSanTokens('1. O-O+ O-O-O# 2. 0-0+ 0-0-0# 3. Nbd7 R1e2 4. exd8=Q+'))
      .toEqual(['O-O+', 'O-O-O#', 'O-O+', 'O-O-O#', 'Nbd7', 'R1e2', 'exd8=Q+']);
  });

  it('reads move text from an open Chess.com shadow root', () => {
    const moveNode = {
      innerText: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
      textContent: '',
      contains: () => false,
    } as unknown as HTMLElement;
    const shadowRoot = {
      querySelectorAll: (selector: string) => selector === '.move-text-component' ? [moveNode] : [],
      querySelector: () => null,
    } as unknown as ShadowRoot;
    const host = { shadowRoot, contains: () => false } as unknown as HTMLElement;
    const doc = {
      querySelectorAll: (selector: string) => selector === '*' ? [host] : [],
      querySelector: () => null,
    } as unknown as Document;

    expect(readLiveMoves(doc, 'https://www.chess.com/game/live/123456'))
      ?.toMatchObject({ site: 'chesscom', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'] });
  });

  it('ignores comments and non-SAN page text', () => {
    expect(parseSanTokens('1. d4 {Opening move} 0:05 d5 2. c4 (Queen’s Gambit) e6'))
      .toEqual(['d4', 'd5', 'c4', 'e6']);
  });
});
