import { replay } from '@opmas/chess-core';
import { parsePgn } from '@opmas/pgn-parser';

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('usage: tsx tools/opening-converter/src/index.ts "1. e4 e5 2. Nf3"');
  process.exit(1);
}
const plies = replay(parsePgn(input).moves);
console.log('SAN:', plies.map((p) => p.san).join(' '));
console.log('UCI:', plies.map((p) => p.uci).join(' '));
console.log('KEY:', plies.at(-1)?.key);
