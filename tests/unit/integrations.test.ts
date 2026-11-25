import { describe, expect, it, vi } from 'vitest';
import { fetchChesscomGame, fetchLichessGame } from '../../packages/integrations/src/index.ts';

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('fetchLichessGame status handling', () => {
  it('recognizes active games as in progress', async () => {
    const fetcher = vi.fn(async () => response({ status: 'started', variant: 'standard', moves: 'e4' }));
    await expect(fetchLichessGame('AbCd1234', fetcher)).resolves.toEqual({ status: 'in-progress' });
  });

  it('recognizes known completed games', async () => {
    const fetcher = vi.fn(async () => response({ status: 'mate', variant: 'standard', moves: 'e4 e5' }));
    await expect(fetchLichessGame('AbCd1234', fetcher)).resolves.toEqual({ status: 'finished', sans: ['e4', 'e5'], startFen: undefined });
  });

  it.each(['aborted', 'noStart', 'futureStatus'])('fails closed for status %s', async (status) => {
    const fetcher = vi.fn(async () => response({ status, variant: 'standard', moves: 'e4' }));
    await expect(fetchLichessGame('AbCd1234', fetcher)).resolves.toEqual({ status: 'unknown' });
  });

  it('fails closed for non-standard variants', async () => {
    const fetcher = vi.fn(async () => response({ status: 'mate', variant: 'chess960', moves: 'e4' }));
    await expect(fetchLichessGame('AbCd1234', fetcher)).resolves.toEqual({ status: 'unknown' });
  });
});

describe('fetchChesscomGame result handling', () => {
  it.each(['1-0', '0-1', '1/2-1/2'])('accepts the standard terminal result %s', async (result) => {
    const fetcher = vi.fn(async () => response({ game: { isFinished: false, moveList: '', pgnHeaders: { Result: result } } }));
    await expect(fetchChesscomGame('live', '123', fetcher)).resolves.toMatchObject({ status: 'finished' });
  });

  it('does not treat arbitrary result strings as finished', async () => {
    const fetcher = vi.fn(async () => response({ game: { moveList: '', pgnHeaders: { Result: 'some-value' } } }));
    await expect(fetchChesscomGame('live', '123', fetcher)).resolves.toEqual({ status: 'unknown' });
  });
});
