import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { parseGameUrl } from '@opmas/safety-gate';
import { fetchGame, gameToSans } from '@opmas/integrations';

const dataUrl = new URL('../../../data/openings/openings.json', import.meta.url);
const db = new OpeningDatabase(JSON.parse(readFileSync(dataUrl, 'utf8')) as Opening[]);
const ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';

function send(res: ServerResponse, code: number, body?: unknown): void {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 100_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204);
    if (url.pathname === '/health') return send(res, 200, { ok: true, openings: db.size });
    if (url.pathname === '/openings') return send(res, 200, db.search(url.searchParams.get('q') ?? '', 50));
    if (url.pathname === '/detect' && req.method === 'POST') {
      const { pgn } = JSON.parse(await readBody(req)) as { pgn?: string };
      const parsed = parsePgn(pgn ?? '');
      return send(res, 200, detectOpening(db, parsed.moves, parsed.headers['FEN']));
    }
    if (url.pathname === '/game') {
      // Only ids parsed from chess.com/lichess game URLs are fetched (no open proxy); finished games only.
      const ref = parseGameUrl(url.searchParams.get('url') ?? '');
      if (!ref) return send(res, 400, { error: 'unsupported game url' });
      const game = await fetchGame(ref);
      if (game.status !== 'finished') return send(res, 403, { status: game.status });
      return send(res, 200, { sans: gameToSans(game) });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 400, { error: e instanceof Error ? e.message : 'bad request' });
  }
}).listen(Number(process.env['PORT'] ?? 8787));
