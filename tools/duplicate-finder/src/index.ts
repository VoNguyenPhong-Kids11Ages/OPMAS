import { readFileSync, writeFileSync } from 'node:fs';
import type { Opening } from '@opmas/opening-database';

const root = new URL('../../../', import.meta.url);
const list = JSON.parse(readFileSync(new URL('data/openings/openings.json', root), 'utf8')) as Opening[];

const exact = new Set<string>();
const dupes: string[] = [];
const byKey = new Map<string, Opening[]>();
for (const o of list) {
  const id = `${o.eco}|${o.name}|${o.pgn}`;
  if (exact.has(id)) dupes.push(id);
  exact.add(id);
  byKey.set(o.key, [...(byKey.get(o.key) ?? []), o]);
}

// Different named lines that reach the same position are transpositions: informational, not an error.
const transpositions = [...byKey.values()]
  .filter((g) => g.length > 1)
  .map((g) => ({ key: g[0]!.key, openings: g.map(({ eco, name, pgn }) => ({ eco, name, pgn })) }));
writeFileSync(new URL('data/transpositions/transpositions.json', root), JSON.stringify(transpositions, null, 1));

console.log(`exact duplicates: ${dupes.length}; positions shared by 2+ lines: ${transpositions.length}`);
if (dupes.length) {
  console.error(dupes.join('\n'));
  process.exit(1);
}
