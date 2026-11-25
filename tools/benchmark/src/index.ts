import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';

const list = JSON.parse(
  readFileSync(new URL('../../../data/openings/openings.json', import.meta.url), 'utf8'),
) as Opening[];
const db = new OpeningDatabase(list);

const t0 = performance.now();
let hits = 0;
for (const o of list) if (detectOpening(db, o.moves)) hits++;
const ms = performance.now() - t0;
console.log(`${list.length} detections in ${ms.toFixed(0)} ms (${Math.round(list.length / (ms / 1000))}/s), ${hits} hits`);
