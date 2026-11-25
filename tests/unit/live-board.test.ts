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

  it('reads the Lichess page-init-data move history when it is more complete than the DOM', () => {
    const script = {
      textContent: JSON.stringify({
        data: { game: { turns: 3, steps: [
          { ply: 0, san: null },
          { ply: 1, san: 'e4' },
          { ply: 2, san: 'e5' },
          { ply: 3, san: 'Nf3' },
        ] } },
      }),
    } as HTMLScriptElement;
    const doc = {
      querySelector: (selector: string) => selector === '#page-init-data' ? script : null,
      querySelectorAll: () => [],
    } as unknown as Document;

    expect(readLiveMoves(doc, 'https://lichess.org/game/abc'))
      ?.toMatchObject({
        site: 'lichess',
        moves: ['e4', 'e5', 'Nf3'],
        source: '#page-init-data data.game.steps[].san',
      });
  });

  it('does not let a shorter Lichess bootstrap snapshot replace a fuller visible move list', () => {
    const script = {
      textContent: JSON.stringify({
        data: { game: { turns: 2, steps: [
          { ply: 0, san: null }, { ply: 1, san: 'e4' }, { ply: 2, san: 'e5' },
        ] } },
      }),
    } as HTMLScriptElement;
    const moveNode = { innerText: '1. e4 e5 2. Nf3 Nc6', textContent: '', contains: () => false } as unknown as HTMLElement;
    const doc = {
      querySelector: (selector: string) => selector === '#page-init-data' ? script : null,
      querySelectorAll: (selector: string) => selector === '.round__app .moves .move' ? [moveNode] : [],
    } as unknown as Document;

    expect(readLiveMoves(doc, 'https://lichess.org/game/abc')?.moves)
      .toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('ignores comments and non-SAN page text', () => {
    expect(parseSanTokens('1. d4 {Opening move} 0:05 d5 2. c4 (Queen’s Gambit) e6'))
      .toEqual(['d4', 'd5', 'c4', 'e6']);
  });
});
