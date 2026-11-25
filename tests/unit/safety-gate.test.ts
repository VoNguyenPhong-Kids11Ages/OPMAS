import { describe, expect, it } from 'vitest';
import { checkGate, isPlayContext, parseGameUrl } from '../../packages/safety-gate/src/index.ts';

describe('parseGameUrl', () => {
  it('parses lichess and chess.com game links', () => {
    expect(parseGameUrl('https://lichess.org/AbCd1234/black')).toEqual({ site: 'lichess', id: 'AbCd1234' });
    expect(parseGameUrl('https://www.chess.com/game/live/123456789')).toEqual({ site: 'chesscom', kind: 'live', id: '123456789' });
    expect(parseGameUrl('https://www.chess.com/analysis/game/daily/42')?.kind).toBe('daily');
  });
  it('rejects non-game pages', () => {
    expect(parseGameUrl('https://lichess.org/analysis')).toBeNull();
    expect(parseGameUrl('https://example.com/AbCd1234')).toBeNull();
    expect(isPlayContext('https://www.chess.com/play/online')).toBe(true);
  });
});

describe('checkGate', () => {
  const url = 'https://lichess.org/AbCd1234';
  it('allows only confirmed-finished games', async () => {
    expect((await checkGate(url, async () => 'finished')).allowed).toBe(true);
    expect(await checkGate(url, async () => 'in-progress')).toEqual({ allowed: false, reason: 'game-in-progress' });
  });
  it('fails closed on unknown status or errors', async () => {
    expect(await checkGate(url, async () => 'unknown')).toEqual({ allowed: false, reason: 'status-unknown' });
    expect((await checkGate(url, async () => { throw new Error('network'); })).allowed).toBe(false);
  });
  it('allows non-game pages', async () => {
    expect((await checkGate('https://lichess.org/', async () => 'unknown')).allowed).toBe(true);
  });
});
