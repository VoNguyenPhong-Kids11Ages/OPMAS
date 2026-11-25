import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../../locales/', import.meta.url);
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, unknown>;
const base = load('en.json');
const errors: string[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const loc = load(file);
  for (const key of Object.keys(base)) {
    const a = base[key];
    const b = loc[key];
    if (b === undefined) errors.push(`${file}: missing "${key}"`);
    else if (Array.isArray(a) && (!Array.isArray(b) || a.length !== b.length)) errors.push(`${file}: "${key}" must be a list of ${a.length}`);
    else if (b === '') errors.push(`${file}: empty "${key}"`);
  }
  for (const key of Object.keys(loc)) if (!(key in base)) errors.push(`${file}: unknown key "${key}"`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('localization-checker OK');
