export interface ParsedPgn {
  headers: Record<string, string>;
  moves: string[];
  result: string;
}

const SAN = /^(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?)[+#]?$/;
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

/** Removes (possibly nested) variations. */
export function stripVariations(text: string): string {
  let depth = 0;
  let out = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

export function normalizeSan(move: string): string {
  return move
    .replace(/[!?]+$/, '')
    .replace(/^0-0-0/, 'O-O-O')
    .replace(/^0-0/, 'O-O');
}

export function parsePgn(input: string): ParsedPgn {
  const headers: Record<string, string> = {};
  let body = input.replace(/\r/g, '');
  body = body.replace(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm, (_m, k: string, v: string) => {
    headers[k] = v.replace(/\\(["\\])/g, '$1');
    return '';
  });
  body = body.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  body = stripVariations(body).replace(/\$\d+/g, ' ');

  const moves: string[] = [];
  let result = headers['Result'] ?? '*';
  for (const raw of body.split(/\s+/)) {
    if (!raw) continue;
    if (RESULTS.has(raw)) {
      result = raw;
      continue;
    }
    const tok = raw.replace(/^\d+\.(?:\.\.)?/, '');
    const san = normalizeSan(tok);
    if (san && SAN.test(san)) moves.push(san);
  }
  return { headers, moves, result };
}
