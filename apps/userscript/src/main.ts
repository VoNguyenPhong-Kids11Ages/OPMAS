import openings from '../../../data/openings/openings.json';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { createTranslator, LOCALES } from '@opmas/localization';
import { checkGate } from '@opmas/safety-gate';
import { fetchStatus } from '@opmas/integrations';

const db = new OpeningDatabase(openings as Opening[]);
const LANG_KEY = 'opmas-language';
const SAFETY_KEY = 'opmas-safety-v1';
let tr = createTranslator(localStorage.getItem(LANG_KEY) ?? 'en');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', css = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.textContent = text;
  if (css) e.style.cssText = css;
  return e;
}

function confirmSafety(): boolean {
  if (sessionStorage.getItem(SAFETY_KEY) === 'true') return true;
  const warnings = tr.t('warnings');
  for (let i = 0; i < warnings.length; i++) {
    if (!confirm(`OPMAS\n\n${i + 1}/${warnings.length}\n\n${warnings[i]}`)) return false;
  }
  sessionStorage.setItem(SAFETY_KEY, 'true');
  return true;
}

const panel = el('section', '', 'position:fixed;right:18px;top:90px;width:340px;max-height:78vh;overflow:auto;z-index:2147483647;background:#171c28;color:#f4f5f7;border:1px solid #394458;border-radius:13px;padding:14px;font:14px Arial,sans-serif;display:none');
const toggle = el('button', '♟ OPMAS', 'position:fixed;right:18px;bottom:20px;z-index:2147483646;border:0;background:#3478db;color:#fff;border-radius:9px;padding:12px 15px;font-weight:bold;cursor:pointer');

async function render(): Promise<void> {
  panel.replaceChildren();
  const head = el('div', '', 'display:flex;justify-content:space-between;gap:8px;margin-bottom:10px');
  const select = el('select');
  for (const [code, msgs] of Object.entries(LOCALES)) {
    const o = new Option(msgs.label, code);
    o.selected = code === tr.code;
    select.add(o);
  }
  select.onchange = () => {
    localStorage.setItem(LANG_KEY, select.value);
    tr = createTranslator(select.value);
    void render();
  };
  const close = el('button', '×');
  close.onclick = () => (panel.style.display = 'none');
  head.append(el('b', tr.t('title')), select, close);
  panel.append(head);

  // Fail-closed: on a game page the game must be confirmed finished.
  const gate = await checkGate(location.href, fetchStatus);
  if (!gate.allowed) {
    panel.append(el('p', tr.t('blocked')));
    return;
  }

  const out = el('div', '', 'margin-top:8px');
  const search = el('input', '', 'width:100%;margin-bottom:8px');
  search.placeholder = tr.t('search');
  search.oninput = () => {
    out.replaceChildren(...db.search(search.value, 20).map((o) => el('div', `${o.eco}  ${o.name}`)));
  };
  const area = el('textarea', '', 'width:100%');
  area.rows = 4;
  area.placeholder = tr.t('paste');
  const go = el('button', tr.t('analyze'));
  go.onclick = () => {
    out.replaceChildren();
    const d = detectOpening(db, parsePgn(area.value).moves);
    if (!d) return void out.append(el('p', tr.t('noResult')));
    out.append(el('b', `${d.opening.eco}  ${d.opening.name}`), el('p', d.opening.pgn));
  };
  panel.append(
    el('div', `${tr.t('count')}: ${db.size}${db.size ? '' : ' (run pnpm build:db)'}`, 'font-size:12px;margin-bottom:8px'),
    search, area, go, out,
  );
}

toggle.onclick = () => {
  if (panel.style.display !== 'none') return void (panel.style.display = 'none');
  if (!confirmSafety()) return;
  panel.style.display = 'block';
  void render();
};
document.body.append(panel, toggle);

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (panel.style.display !== 'none') void render();
  }
}, 1500);
