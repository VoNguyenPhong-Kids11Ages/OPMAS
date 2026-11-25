import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { replay } from '@opmas/chess-core';
import { parsePgn } from '@opmas/pgn-parser';
import type { Opening } from '@opmas/opening-database';

// Builds data/openings/openings.json from the lichess-org/chess-openings TSVs (columns: eco, name, pgn).
const root = new URL('../../../', import.meta.url);
const srcDir = new URL('data/sources/lichess-chess-openings/', root);
const files = readdirSync(srcDir).filter((f) => /^[a-e]\.tsv$/.test(f)).sort();
if (!files.length) {
  console.error('No TSV files found. Run: pnpm fetch:sources');
  process.exit(1);
}

const out: Opening[] = [];
let skipped = 0;
for (const file of files) {
  const lines = readFileSync(new URL(file, srcDir), 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = lines.shift()!.split('\t');
  const [iE, iN, iP] = ['eco', 'name', 'pgn'].map((c) => cols.indexOf(c)) as [number, number, number];
  if (iE < 0 || iN < 0 || iP < 0) throw new Error(`${file}: expected columns eco, name, pgn; got ${cols.join(',')}`);
  for (const line of lines) {
    const c = line.split('\t');
    const [eco, name, pgn] = [c[iE], c[iN], c[iP]];
    if (!eco || !name || !pgn) {
      skipped++;
      continue;
    }
    try {
      const plies = replay(parsePgn(pgn).moves);
      if (!plies.length) throw new Error('empty line');
      out.push({ eco, name, pgn, moves: plies.map((p) => p.san), key: plies.at(-1)!.key, ply: plies.length });
    } catch {
      skipped++;
      console.warn(`skip: ${eco} ${name}`);
    }
  }
}
out.sort((a, b) => a.eco.localeCompare(b.eco) || a.ply - b.ply || a.name.localeCompare(b.name));

mkdirSync(new URL('data/openings/', root), { recursive: true });
writeFileSync(new URL('data/openings/openings.json', root), JSON.stringify(out));
const eco: Record<string, string[]> = {};
for (const o of out) (eco[o.eco] ??= []).push(o.name);
writeFileSync(new URL('data/eco/index.json', root), JSON.stringify(eco, null, 1));
console.log(`openings: ${out.length}, skipped: ${skipped}`);
