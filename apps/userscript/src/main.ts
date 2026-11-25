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

type MenuRegistrar = (caption: string, callback: () => void) => number;
const registerMenu = (globalThis as typeof globalThis & {
  GM_registerMenuCommand?: MenuRegistrar;
}).GM_registerMenuCommand;

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

const panel = el('section', '', 'position:fixed;right:18px;top:90px;width:min(360px,calc(100vw - 36px));max-height:78vh;overflow:auto;z-index:2147483647;background:#101a30;color:#f4f7ff;border:1px solid #2563a8;border-radius:14px;padding:14px;font:14px system-ui,sans-serif;box-shadow:0 12px 40px #0009;display:none');
const toggle = el('button', '♞ OPMAS', 'position:fixed;right:18px;bottom:20px;z-index:2147483646;border:1px solid #55c8f5;background:#102b55;color:#fff;border-radius:10px;padding:11px 15px;font-weight:800;letter-spacing:.3px;cursor:pointer;box-shadow:0 4px 18px #0008');
const search = el('input', '', 'box-sizing:border-box;width:100%;padding:9px;margin:8px 0;background:#07152b;color:#fff;border:1px solid #365477;border-radius:8px');
search.placeholder = 'Search ECO / opening name…';
const area = el('textarea', '', 'box-sizing:border-box;width:100%;padding:9px;background:#07152b;color:#fff;border:1px solid #365477;border-radius:8px');
area.rows = 5;
area.placeholder = 'Paste PGN here…';
const out = el('div', '', 'margin-top:10px;line-height:1.5');
const status = el('p', '', 'font-size:12px;color:#9bb3d1');

function showPanel(focus: 'search' | 'pgn' | null = null): void {
  if (!confirmSafety()) return;
  panel.style.display = 'block';
  if (focus === 'search') search.focus();
  if (focus === 'pgn') area.focus();
}
function hidePanel(): void { panel.style.display = 'none'; }

async function refreshGate(): Promise<boolean> {
  const gate = await checkGate(location.href, fetchStatus);
  if (!gate.allowed) {
    out.replaceChildren(el('p', tr.t('blocked')));
    return false;
  }
  return true;
}

function renderSearch(): void {
  const matches = db.search(search.value, 20);
  out.replaceChildren();
  if (!matches.length) {
    out.append(el('p', 'No matching openings.'));
    return;
  }
  for (const opening of matches) {
    const item = el('button', `${opening.eco}  ·  ${opening.name}`,
      'display:block;width:100%;text-align:left;margin:4px 0;padding:8px;background:#172b49;color:#eaf4ff;border:1px solid #29496d;border-radius:7px;cursor:pointer');
    item.onclick = () => {
      out.replaceChildren(el('b', `${opening.eco} · ${opening.name}`), el('p', opening.pgn));
    };
    out.append(item);
  }
}

function analyzePgn(): void {
  out.replaceChildren();
  const parsed = parsePgn(area.value);
  const result = detectOpening(db, parsed.moves);
  if (!result) {
    out.append(el('p', tr.t('noResult')));
    return;
  }
  out.append(el('b', `${result.opening.eco} · ${result.opening.name}`), el('p', result.opening.pgn));
}

async function render(): Promise<void> {
  panel.replaceChildren();
  const head = el('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px');
  const brand = el('strong', '♞ OPMAS', 'font-size:17px;letter-spacing:.5px;color:#72d8ff');
  const controls = el('div', '', 'display:flex;gap:6px');
  const select = el('select', '', 'max-width:100px;background:#172b49;color:white;border:1px solid #365477;border-radius:6px;padding:5px');
  for (const [code, msgs] of Object.entries(LOCALES)) {
    const option = new Option(msgs.label, code);
    option.selected = code === tr.code;
    select.add(option);
  }
  select.onchange = () => {
    localStorage.setItem(LANG_KEY, select.value);
    tr = createTranslator(select.value);
    void render();
  };
  const close = el('button', '×', 'background:#263b59;color:white;border:0;border-radius:6px;padding:4px 10px;cursor:pointer');
  close.onclick = hidePanel;
  controls.append(select, close);
  head.append(brand, controls);
  panel.append(head);

  if (!await refreshGate()) return;

  status.textContent = `Opening database · ${db.size} entries`;
  const searchLabel = el('label', 'Opening Explorer', 'display:block;font-weight:700;margin-top:8px');
  const searchResults = el('div');
  search.oninput = () => {
    const matches = db.search(search.value, 20);
    searchResults.replaceChildren();
    for (const opening of matches) {
      const item = el('button', `${opening.eco} · ${opening.name}`,
        'display:block;width:100%;text-align:left;margin:4px 0;padding:8px;background:#172b49;color:#eaf4ff;border:1px solid #29496d;border-radius:7px;cursor:pointer');
      item.onclick = () => searchResults.replaceChildren(el('b', `${opening.eco} · ${opening.name}`), el('p', opening.pgn));
      searchResults.append(item);
    }
  };
  const pgnLabel = el('label', 'PGN Analyzer', 'display:block;font-weight:700;margin-top:14px');
  const analyze = el('button', 'Analyze PGN', 'margin-top:7px;padding:9px 12px;background:#1676c5;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer');
  analyze.onclick = analyzePgn;
  panel.append(status, searchLabel, search, searchResults, pgnLabel, area, analyze, out);
}

toggle.onclick = () => {
  if (panel.style.display !== 'none') return hidePanel();
  showPanel();
  void render();
};
document.body.append(panel, toggle);

if (registerMenu) {
  registerMenu('♞ OPMAS — Open GUI', () => { showPanel(); void render(); });
  registerMenu('OPMAS — Search openings', () => { showPanel('search'); void render(); });
  registerMenu('OPMAS — Analyze PGN', () => { showPanel('pgn'); void render(); });
  registerMenu('OPMAS — Close GUI', hidePanel);
}

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (panel.style.display !== 'none') void render();
  }
}, 1500);
