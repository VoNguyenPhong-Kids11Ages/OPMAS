import openings from '../../../data/openings/openings.json';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { createTranslator, LOCALES } from '@opmas/localization';
import { checkGate, parseGameUrl } from '@opmas/safety-gate';
import { fetchGame, fetchStatus, gameToSans } from '@opmas/integrations';

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
    if (!confirm(`OPMAS\\n\\n${i + 1}/${warnings.length}\\n\\n${warnings[i]}`)) return false;
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

  // Fail-closed: never expose game analysis while a game is active or its status is unknown.
  const gate = await checkGate(location.href, fetchStatus);
  if (!gate.allowed) {
    panel.append(el('p', tr.t('blocked')));
    return;
  }

  const out = el('div', '', 'margin-top:8px');
  const linkLabel = el('label', 'Import a finished game (Lichess / Chess.com)', 'display:block;margin:8px 0 5px;font-weight:bold');
  const link = el('input', '', 'box-sizing:border-box;width:100%;padding:7px;margin-bottom:6px');
  link.type = 'url';
  link.placeholder = 'Paste a finished game URL';
  if (parseGameUrl(location.href)) link.value = location.href;
  const importButton = el('button', 'Load finished game');
  importButton.onclick = async () => {
    out.replaceChildren();
    const ref = parseGameUrl(link.value.trim());
    if (!ref) {
      out.append(el('p', 'That link is not a recognized Lichess or Chess.com game URL.'));
      return;
    }
    importButton.disabled = true;
    importButton.textContent = 'Loading…';
    try {
      const game = await fetchGame(ref);
      if (game.status !== 'finished') {
        out.append(el('p', game.status === 'in-progress'
          ? 'This game is still in progress. OPMAS only imports completed games.'
          : 'Could not verify that this game is finished. Check the link or try again later.'));
        return;
      }
      const sans = gameToSans(game);
      if (!sans.length) {
        out.append(el('p', 'The game was found, but no moves could be read.'));
        return;
      }
      const detection = detectOpening(db, sans, game.startFen);
      if (!detection) {
        out.append(el('p', 'Moves loaded, but no opening could be identified from this game.'));
        return;
      }
      out.append(
        el('b', `${detection.opening.eco}  ${detection.opening.name}`),
        el('p', `Matched through move ${Math.ceil(detection.ply / 2)} (${detection.ply} plies) · ${detection.exact ? 'exact line' : 'deepest known position'}`),
        el('p', detection.opening.pgn),
      );
    } catch {
      out.append(el('p', 'Could not load this game. The site may have changed its endpoint or blocked the request.'));
    } finally {
      importButton.disabled = false;
      importButton.textContent = 'Load finished game';
    }
  };

  const search = el('input', '', 'width:100%;margin:8px 0');
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
    linkLabel, link, importButton,
    el('div', `${tr.t('count')}: ${db.size}${db.size ? '' : ' (run pnpm build:db)'}`, 'font-size:12px;margin:10px 0 8px'),
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
