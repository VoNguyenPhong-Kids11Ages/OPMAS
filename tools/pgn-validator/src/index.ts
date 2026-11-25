import { readFileSync } from 'node:fs';
import { tryReplay } from '@opmas/chess-core';
import { parsePgn } from '@opmas/pgn-parser';
import type { Opening } from '@opmas/opening-database';

const list = JSON.parse(
  readFileSync(new URL('../../../data/openings/openings.json', import.meta.url), 'utf8'),
) as Opening[];

const errors: string[] = [];
for (const o of list) {
  const plies = tryReplay(parsePgn(o.pgn).moves);
  if (!plies) errors.push(`illegal line: ${o.eco} ${o.name} (${o.pgn})`);
  else if (plies.length !== o.moves.length || plies.at(-1)?.key !== o.key) errors.push(`stale record: ${o.eco} ${o.name}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`pgn-validator OK (${list.length} openings)`);
