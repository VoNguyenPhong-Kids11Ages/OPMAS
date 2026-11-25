import { readFileSync } from 'node:fs';
import type { Opening } from '@opmas/opening-database';

const list = JSON.parse(
  readFileSync(new URL('../../../data/openings/openings.json', import.meta.url), 'utf8'),
) as Opening[];
if (!list.length) {
  console.error('openings.json is empty (run pnpm fetch:sources && pnpm build:db first)');
  process.exit(1);
}

const errors: string[] = [];
for (const o of list) {
  if (!/^[A-E]\d{2}$/.test(o.eco)) errors.push(`bad ECO "${o.eco}" (${o.name})`);
  if (!o.name.trim()) errors.push(`empty name for ${o.eco}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`eco-validator OK (${list.length} openings)`);
