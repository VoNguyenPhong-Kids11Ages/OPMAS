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
const FAV_KEY = 'opmas-favorites-v1';
let tr = createTranslator(localStorage.getItem(LANG_KEY) ?? 'en');
let activeTab: 'explorer' | 'analyzer' | 'favorites' = 'explorer';
let selectedPgn: string | null = null;
let focusAfterRender: 'search' | 'pgn' | null = null;
let gateAllowed = false;

type MenuRegistrar = (caption: string, callback: () => void) => number;
const registerMenu = (globalThis as typeof globalThis & {
  GM_registerMenuCommand?: MenuRegistrar;
}).GM_registerMenuCommand;

const css = {
  input: 'box-sizing:border-box;width:100%;padding:10px;margin:7px 0;background:#08162d;color:#f4f7ff;border:1px solid #345477;border-radius:8px;outline:none',
  button: 'padding:8px 10px;background:#19385d;color:#eaf5ff;border:1px solid #365b82;border-radius:8px;font-weight:650;cursor:pointer',
  primary: 'padding:9px 12px;background:#087dbb;color:white;border:1px solid #28b9ed;border-radius:8px;font-weight:750;cursor:pointer',
  muted: 'font-size:12px;color:#9bb3d1;line-height:1.5',
  card: 'padding:10px;margin:7px 0;background:#132945;border:1px solid #294969;border-radius:9px',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', style = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  if (style) node.style.cssText = style;
  return node;
}

function button(label: string, action: () => void, primary = false): HTMLButtonElement {
  const node = el('button', label, primary ? css.primary : css.button);
  node.type = 'button';
  node.onclick = action;
  return node;
}

function getFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function isFavorite(opening: Opening): boolean {
  return getFavorites().includes(opening.pgn);
}

function toggleFavorite(opening: Opening): void {
  const favorites = getFavorites();
  const next = favorites.includes(opening.pgn)
    ? favorites.filter((item) => item !== opening.pgn)
    : [...favorites, opening.pgn];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  renderContent();
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    setNotice('Copied to clipboard ✓');
  } catch {
    const temp = el('textarea');
    temp.value = value;
    temp.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(temp);
    temp.select();
    const copied = document.execCommand('copy');
    temp.remove();
    setNotice(copied ? 'Copied to clipboard ✓' : 'Clipboard unavailable in this page.');
  }
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

const panel = el('section', '', 'position:fixed;right:16px;top:76px;width:min(390px,calc(100vw - 24px));max-height:82vh;overflow:auto;z-index:2147483647;box-sizing:border-box;background:#0d192c;color:#f4f7ff;border:1px solid #2876a8;border-radius:15px;padding:13px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 14px 48px #000b;display:none');
const launcher = el('button', '♞ OPMAS', 'position:fixed;right:18px;bottom:20px;z-index:2147483646;border:1px solid #55c8f5;background:#102b55;color:#fff;border-radius:11px;padding:11px 15px;font-weight:850;letter-spacing:.4px;cursor:pointer;box-shadow:0 4px 20px #0009');
const content = el('div');
const notice = el('p', '', 'min-height:18px;margin:7px 2px;color:#71d9ff;font-size:12px');
const searchInput = el('input', '', css.input);
searchInput.placeholder = 'Search name, ECO, or moves…';
searchInput.type = 'search';
const pgnInput = el('textarea', '', css.input);
pgnInput.rows = 7;
pgnInput.placeholder = 'Paste a PGN here…';
const langSelect = el('select', '', 'max-width:105px;background:#172b49;color:white;border:1px solid #365477;border-radius:7px;padding:6px');

function setNotice(message: string): void {
  notice.textContent = message;
  window.setTimeout(() => {
    if (notice.textContent === message) notice.textContent = '';
  }, 2600);
}

function openPanel(tab: typeof activeTab = 'explorer', focus: 'search' | 'pgn' | null = null): void {
  if (!confirmSafety()) return;
  activeTab = tab;
  focusAfterRender = focus;
  panel.style.display = 'block';
  void render();
}
function closePanel(): void { panel.style.display = 'none'; }

function makeHeader(): HTMLElement {
  const header = el('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px');
  const brand = el('div', '', 'display:flex;align-items:center;gap:8px');
  const avatar = el('span', '♞', 'display:grid;place-items:center;width:32px;height:32px;background:#102b55;border:1px solid #3dbce9;border-radius:8px;color:#ffd34f;font-size:22px');
  const title = el('div', 'OPMAS', 'font-size:17px;font-weight:900;letter-spacing:.8px;color:#76ddff');
  const subtitle = el('div', 'OPENING MASTER', 'font-size:9px;letter-spacing:1.4px;color:#93aeca');
  const titleWrap = el('div');
  titleWrap.append(title, subtitle);
  brand.append(avatar, titleWrap);
  const right = el('div', '', 'display:flex;align-items:center;gap:6px');
  langSelect.replaceChildren();
  for (const [code, messages] of Object.entries(LOCALES)) {
    const option = new Option(messages.label, code);
    option.selected = code === tr.code;
    langSelect.add(option);
  }
  langSelect.onchange = () => {
    localStorage.setItem(LANG_KEY, langSelect.value);
    tr = createTranslator(langSelect.value);
    void render();
  };
  right.append(langSelect, button('—', () => { panel.style.display = 'none'; }, false), button('×', closePanel));
  header.append(brand, right);
  return header;
}

function makeTabs(): HTMLElement {
  const nav = el('div', '', 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0');
  const tabs: Array<[typeof activeTab, string]> = [
    ['explorer', '♟ Explorer'],
    ['analyzer', '⌕ PGN'],
    ['favorites', '★ Saved'],
  ];
  for (const [tab, label] of tabs) {
    const item = button(label, () => { activeTab = tab; renderContent(); });
    item.style.background = activeTab === tab ? '#087dbb' : '#142943';
    item.style.borderColor = activeTab === tab ? '#35bff0' : '#294969';
    nav.append(item);
  }
  return nav;
}

function showOpening(opening: Opening, host: HTMLElement): void {
  selectedPgn = opening.pgn;
  const card = el('article', '', css.card);
  const top = el('div', '', 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px');
  const name = el('div', '', 'min-width:0');
  name.append(el('div', opening.name, 'font-weight:800;color:#f4f8ff'), el('div', `ECO ${opening.eco} · ${opening.ply} plies`, css.muted));
  top.append(name, button(isFavorite(opening) ? '★ Saved' : '☆ Save', () => toggleFavorite(opening)));
  const moves = el('pre', opening.pgn, 'white-space:pre-wrap;overflow-wrap:anywhere;background:#08162d;padding:9px;border-radius:7px;color:#bfe7ff;font:12px/1.6 ui-monospace,monospace');
  const actions = el('div', '', 'display:flex;gap:7px;flex-wrap:wrap');
  actions.append(button('Copy moves', () => void copyText(opening.pgn)), button('Copy ECO', () => void copyText(opening.eco)));
  card.append(top, moves, actions);
  host.replaceChildren(card);
}

function renderExplorer(host: HTMLElement): void {
  const label = el('label', 'Opening Explorer', 'display:block;font-weight:800;margin:8px 0 3px');
  const hint = el('p', `Search across ${db.size.toLocaleString()} opening records. Select an entry to inspect its moves.`, css.muted);
  const filter = el('select', '', css.input);
  filter.add(new Option('All ECO codes', ''));
  for (const letter of ['A', 'B', 'C', 'D', 'E']) filter.add(new Option(`ECO ${letter}`, letter));
  const count = el('p', '', css.muted);
  const list = el('div');
  const detail = el('div');
  const updateList = (): void => {
    const query = searchInput.value.trim().toLowerCase();
    const matches = (filter.value ? db.byEco(filter.value) : db.all())
      .filter((opening) => !query || `${opening.eco} ${opening.name} ${opening.pgn}`.toLowerCase().includes(query))
      .slice(0, 40);
    count.textContent = `Showing ${matches.length} result(s) · maximum 40`;
    list.replaceChildren();
    for (const opening of matches) {
      const item = button(`${opening.eco} · ${opening.name}`, () => showOpening(opening, detail));
      item.style.cssText += ';display:block;width:100%;text-align:left;margin:4px 0;white-space:normal';
      list.append(item);
    }
  };
  filter.onchange = updateList;
  searchInput.oninput = updateList;
  host.replaceChildren(label, hint, searchInput, filter, count, list, detail);
  updateList();
  if (selectedPgn) {
    const selected = db.all().find((opening) => opening.pgn === selectedPgn);
    if (selected) showOpening(selected, detail);
  }
  if (focusAfterRender === 'search') searchInput.focus();
}
function renderAnalyzer(host: HTMLElement): void {
  const heading = el('div', 'PGN Analyzer', 'font-weight:800;margin:8px 0 4px');
  const help = el('p', 'Paste a completed game PGN to identify its deepest matching opening. OPMAS does not provide live-game move assistance.', css.muted);
  const actions = el('div', '', 'display:flex;gap:7px;flex-wrap:wrap;margin:7px 0');
  const result = el('div');
  const analyze = button('⌕ Analyze PGN', () => {
    const parsed = parsePgn(pgnInput.value);
    if (!parsed.moves.length) {
      result.replaceChildren(el('p', 'No valid SAN moves found. Check the PGN text.', 'color:#ffbd75'));
      return;
    }
    const detection = detectOpening(db, parsed.moves);
    if (!detection) {
      result.replaceChildren(el('p', 'No matching opening position found in the database.', css.muted));
      return;
    }
    const card = el('article', '', css.card);
    card.append(
      el('div', `${detection.opening.eco} · ${detection.opening.name}`, 'font-weight:850;color:#7bdcff'),
      el('p', `Matched at ply ${detection.ply} of ${parsed.moves.length} · ${detection.exact ? 'exact position' : 'deepest earlier match'}`, css.muted),
      el('p', `Moves parsed: ${parsed.moves.length} · Result: ${parsed.result}`, css.muted),
      button('Save opening', () => toggleFavorite(detection.opening)),
    );
    result.replaceChildren(card);
  }, true);
  actions.append(analyze, button('Copy PGN', () => void copyText(pgnInput.value)), button('Clear', () => { pgnInput.value = ''; result.replaceChildren(); }));
  host.replaceChildren(heading, help, pgnInput, actions, result);
  if (focusAfterRender === 'pgn') pgnInput.focus();
}

function renderFavorites(host: HTMLElement): void {
  const favorites = getFavorites();
  const heading = el('div', 'Saved openings', 'font-weight:800;margin:8px 0');
  const list = el('div');
  for (const pgn of favorites) {
    const opening = db.all().find((item) => item.pgn === pgn);
    if (!opening) continue;
    const item = button(`★ ${opening.eco} · ${opening.name}`, () => showOpening(opening, detail));
    item.style.cssText += ';display:block;width:100%;text-align:left;margin:5px 0;white-space:normal';
    list.append(item);
  }
  const detail = el('div');
  if (!favorites.length) list.append(el('p', 'No saved openings yet. Use ☆ Save in Explorer.', css.muted));
  const clear = button('Clear saved list', () => {
    if (confirm('Remove all saved OPMAS openings?')) {
      localStorage.removeItem(FAV_KEY);
      renderContent();
    }
  });
  host.replaceChildren(heading, list, detail, clear);
}

function renderContent(): void {
  content.replaceChildren(makeTabs());
  if (!gateAllowed) {
    content.append(el('p', tr.t('blocked'), 'padding:12px;background:#3b2630;border-radius:8px;color:#ffd4d4'));
    return;
  }
  const view = el('div');
  content.append(view);
  if (activeTab === 'explorer') renderExplorer(view);
  else if (activeTab === 'analyzer') renderAnalyzer(view);
  else renderFavorites(view);
  focusAfterRender = null;
}

async function render(): Promise<void> {
  panel.replaceChildren(makeHeader(), notice, content);
  const gate = await checkGate(location.href, fetchStatus);
  gateAllowed = gate.allowed;
  const status = el('p', `Database: ${db.size.toLocaleString()} openings · ${gateAllowed ? 'Ready' : 'Restricted on active game pages'}`, css.muted);
  panel.insertBefore(status, content);
  renderContent();
}

launcher.onclick = () => {
  if (panel.style.display !== 'none') return closePanel();
  openPanel();
};
document.body.append(panel, launcher);

if (registerMenu) {
  registerMenu('♞ OPMAS — Open Explorer', () => openPanel('explorer', 'search'));
  registerMenu('OPMAS — Analyze PGN', () => openPanel('analyzer', 'pgn'));
  registerMenu('OPMAS — Saved openings', () => openPanel('favorites'));
  registerMenu('OPMAS — Close GUI', closePanel);
}

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (panel.style.display !== 'none') void render();
  }
}, 1500);
