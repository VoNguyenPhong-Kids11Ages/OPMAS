import { readFileSync } from 'node:fs';

interface Source { id: string; license: string; verified: boolean; url: string | null }
const ALLOWED = new Set(['CC0-1.0', 'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC-BY-4.0']);
const strict = process.argv.includes('--strict');
const { sources } = JSON.parse(
  readFileSync(new URL('../../../data/sources/sources.json', import.meta.url), 'utf8'),
) as { sources: Source[] };

const errors: string[] = [];
const warnings: string[] = [];
for (const s of sources) {
  if (/^(A|L)?GPL/i.test(s.license)) errors.push(`${s.id}: copyleft license ${s.license} is not compatible with this repo's license`);
  else if (!ALLOWED.has(s.license)) warnings.push(`${s.id}: license "${s.license}" needs manual review`);
  if (!s.verified) warnings.push(`${s.id}: not yet verified against upstream`);
}
warnings.forEach((w) => console.warn('warn:', w));
if (errors.length || (strict && warnings.length)) {
  [...errors, ...(strict ? warnings : [])].forEach((e) => console.error('error:', e));
  process.exit(1);
}
console.log(`license-checker OK (${sources.length} sources, ${warnings.length} warnings)`);
