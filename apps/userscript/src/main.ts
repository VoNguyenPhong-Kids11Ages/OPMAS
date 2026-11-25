import openings from '../../../data/openings/openings.json';
import { replay, START_FEN } from '@opmas/chess-core';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { createTranslator, LOCALES } from '@opmas/localization';
import { checkGate } from '@opmas/safety-gate';
import { fetchStatus } from '@opmas/integrations';
import { parseGameUrl, isPlayContext } from '@opmas/safety-gate';
import { readLiveMoves } from './live-board';

const db = new OpeningDatabase(openings as Opening[]);
const KEYS = { language: 'opmas-language', favorites: 'opmas-favorites-v2', safety: 'opmas-safety-v2' };
let tr = createTranslator(localStorage.getItem(KEYS.language) ?? 'vi');
type Tab = 'explorer' | 'analyzer' | 'favorites';
let activeTab: Tab = 'explorer';
let selectedEco: string | null = null;
let gateAllowed = false;
let liveMode = false;
let liveRefreshTimer: number | null = null;
let liveObserver: MutationObserver | null = null;
let renderToken = 0;

type MenuRegistrar = (caption: string, callback: () => void) => number;
const registerMenu = (globalThis as typeof globalThis & { GM_registerMenuCommand?: MenuRegistrar }).GM_registerMenuCommand;

const palette = {
  ink: '#17243a', muted: '#718096', line: '#e4eaf2', surface: '#ffffff', soft: '#f5f8fc',
  blue: '#1769d2', blueSoft: '#eaf3ff', green: '#12805c', amber: '#a86610', red: '#b42318',
};
const style = {
  input: `width:100%;min-width:0;padding:11px 12px;border:1px solid ${palette.line};border-radius:10px;background:#fff;color:${palette.ink};font:inherit;outline:none;box-sizing:border-box`,
  button: `border:1px solid ${palette.line};border-radius:9px;background:#fff;color:${palette.ink};padding:8px 11px;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer`,
  primary: `border:1px solid ${palette.blue};border-radius:9px;background:${palette.blue};color:#fff;padding:9px 12px;font:700 12px/1.3 system-ui,sans-serif;cursor:pointer`,
  muted: `margin:5px 0;color:${palette.muted};font:12px/1.55 system-ui,sans-serif`,
  card: `padding:12px;margin:9px 0;background:#fff;border:1px solid ${palette.line};border-radius:12px`,
};

function t(vi: string, en: string): string { return tr.code === 'vi' ? vi : en; }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', css = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  if (css) node.style.cssText = css;
  return node;
}
function actionButton(label: string, action: () => void, primary = false): HTMLButtonElement {
  const node = el('button', label, primary ? style.primary : style.button);
  node.type = 'button';
  node.onclick = action;
  node.onmouseenter = () => { node.style.filter = 'brightness(.97)'; };
  node.onmouseleave = () => { node.style.filter = ''; };
  return node;
}
function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { setNotice(t('Không thể lưu dữ liệu trong trình duyệt này.', 'Browser storage is unavailable.')); }
}
function getFavorites(): string[] {
  try {
    const raw: unknown = JSON.parse(safeStorageGet(KEYS.favorites) ?? safeStorageGet('opmas-favorites-v1') ?? '[]');
    if (!Array.isArray(raw)) return [];
    const ecos = raw.flatMap((value): string[] => {
      if (typeof value !== 'string') return [];
      const found = db.all().find((opening) => opening.eco === value || opening.pgn === value);
      return found ? [found.eco] : [];
    });
    return [...new Set(ecos)];
  } catch { return []; }
}
function isFavorite(opening: Opening): boolean { return getFavorites().includes(opening.eco); }
function toggleFavorite(opening: Opening): void {
  const current = getFavorites();
  const next = current.includes(opening.eco) ? current.filter((eco) => eco !== opening.eco) : [...current, opening.eco];
  safeStorageSet(KEYS.favorites, JSON.stringify(next));
  renderContent();
}
function setNotice(message: string): void {
  notice.textContent = message;
  window.setTimeout(() => { if (notice.textContent === message) notice.textContent = ''; }, 2800);
}
async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    setNotice(t('Đã sao chép ✓', 'Copied ✓'));
  } catch {
    const temp = el('textarea');
    temp.value = value;
    temp.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(temp);
    temp.select();
    const copied = document.execCommand('copy');
    temp.remove();
    setNotice(copied ? t('Đã sao chép ✓', 'Copied ✓') : t('Không thể truy cập clipboard.', 'Clipboard unavailable.'));
  }
}
function confirmSafety(): boolean {
  if (safeStorageGet(KEYS.safety) === 'true') return true;
  const accepted = confirm(t(
    'OPMAS dùng để học khai cuộc. Trên bàn đang chơi, công cụ chỉ đọc lịch sử nước đi để nhận diện khai cuộc/biến thể; không gợi ý nước đi hay can thiệp bàn cờ. Tiếp tục?',
    'OPMAS is for opening study. On live boards it only reads move history to identify the opening/variation; it does not suggest moves or interact with the board. Continue?',
  ));
  if (accepted) safeStorageSet(KEYS.safety, 'true');
  return accepted;
}

const panel = el('section', '', 'all:initial;display:none;position:fixed!important;z-index:2147483647!important;top:14px!important;right:14px!important;left:auto!important;bottom:auto!important;width:min(440px,calc(100vw - 28px))!important;max-height:calc(100vh - 28px)!important;overflow:auto!important;overscroll-behavior:contain!important;box-sizing:border-box!important;padding:16px!important;background:#fff!important;color:#17243a!important;border:1px solid #e4eaf2!important;border-radius:18px!important;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif!important;box-shadow:0 20px 65px #17243a2b!important;pointer-events:auto!important');
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'OPMAS Opening Master');

const launcher = el('button', '', 'all:initial;position:fixed!important;z-index:2147483647!important;right:18px!important;bottom:18px!important;top:auto!important;left:auto!important;display:flex!important;align-items:center!important;gap:9px!important;padding:11px 15px!important;border:1px solid #1769d2!important;border-radius:13px!important;background:#1769d2!important;color:#fff!important;font:800 13px/1 system-ui,sans-serif!important;letter-spacing:.3px!important;cursor:pointer!important;box-shadow:0 8px 24px #1769d244!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important');
launcher.type = 'button';
launcher.setAttribute('aria-label', 'Open OPMAS Opening Master');
const mark = el('span', '♞', 'font-size:21px;line-height:1;color:#ffdf8b');
launcher.append(mark, document.createTextNode('OPMAS'));
const content = el('div');
const notice = el('p', '', 'min-height:17px;margin:7px 1px;color:#1769d2;font-size:12px;font-weight:650');
const searchInput = el('input', '', style.input);
searchInput.type = 'search';
searchInput.placeholder = t('Tìm tên, ECO hoặc chuỗi nước đi…', 'Search name, ECO or moves…');
const pgnInput = el('textarea', '', style.input);
pgnInput.rows = 8;
pgnInput.placeholder = '1. e4 e5 2. Nf3 Nc6 3. Bb5 ...';

function stopLiveMonitor(): void {
  if (liveRefreshTimer !== null) window.clearInterval(liveRefreshTimer);
  liveRefreshTimer = null;
  liveObserver?.disconnect();
  liveObserver = null;
}
function closePanel(): void { panel.style.display = 'none'; stopLiveMonitor(); }
function openPanel(tab: Tab = 'explorer', focus: 'search' | 'pgn' | null = null): void {
  if (!confirmSafety()) return;
  activeTab = tab;
  panel.style.display = 'block';
  void render(focus);
}
function makeHeader(): HTMLElement {
  const header = el('header', '', 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px');
  const identity = el('div', '', 'display:flex;align-items:center;gap:10px;min-width:0');
  const icon = el('span', '♞', 'display:grid;place-items:center;flex:none;width:39px;height:39px;border-radius:12px;background:#eaf3ff;color:#1769d2;font-size:25px');
  const titleWrap = el('div');
  titleWrap.append(
    el('div', 'OPMAS', 'font-size:18px;font-weight:900;letter-spacing:.5px;color:#14233b'),
    el('div', t('OPENING MASTER · BẢN HỌC TẬP', 'OPENING MASTER · STUDY EDITION'), 'font-size:9px;font-weight:750;letter-spacing:1.1px;color:#8290a4'),
  );
  identity.append(icon, titleWrap);
  const controls = el('div', '', 'display:flex;align-items:center;gap:5px');
  const language = el('select', '', 'max-width:105px;padding:7px 6px;border:1px solid #e4eaf2;border-radius:8px;background:#fff;color:#17243a;font:12px system-ui');
  for (const [code, locale] of Object.entries(LOCALES)) {
    const option = new Option(locale.label, code);
    option.selected = code === tr.code;
    language.add(option);
  }
  language.onchange = () => {
    tr = createTranslator(language.value);
    safeStorageSet(KEYS.language, language.value);
    void render();
  };
  controls.append(language, actionButton('—', closePanel), actionButton('×', closePanel));
  header.append(identity, controls);
  return header;
}
function makeTabs(): HTMLElement {
  const nav = el('nav', '', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:5px;background:#f3f6fa;border-radius:12px;margin:10px 0 13px');
  const tabs: Array<[Tab, string]> = [
    ['explorer', t('Khám phá', 'Explorer')],
    ['analyzer', 'PGN'],
    ['favorites', t('Đã lưu', 'Saved')],
  ];
  for (const [tab, label] of tabs) {
    const selected = activeTab === tab;
    const button = actionButton(label, () => { activeTab = tab; renderContent(); });
    button.style.cssText += selected ? ';background:#fff;border-color:#fff;color:#1769d2;box-shadow:0 1px 5px #17243a12' : ';background:transparent;border-color:transparent;color:#718096';
    nav.append(button);
  }
  return nav;
}
function makeSectionTitle(title: string, subtitle: string): HTMLElement {
  const wrap = el('div', '', 'margin:5px 0 11px');
  wrap.append(el('div', title, 'font-size:15px;font-weight:850;color:#17243a'), el('p', subtitle, style.muted));
  return wrap;
}

const pieces: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
function renderBoard(fen: string, host: HTMLElement): void {
  const board = el('div', '', 'display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:min(100%,300px);aspect-ratio:1;margin:10px auto;border:4px solid #d9e2ed;border-radius:7px;overflow:hidden');
  const rows = fen.split(' ')[0]?.split('/') ?? [];
  rows.forEach((row, rank) => {
    let file = 0;
    for (const char of row) {
      if (/^[1-8]$/.test(char)) {
        const emptyCount = Number(char);
        for (let n = 0; n < emptyCount; n++, file++) {
          const square = el('div', '', `display:grid;place-items:center;background:${(rank + file) % 2 === 0 ? '#edf2f7' : '#9bb4cf'};font-size:clamp(16px,5vw,29px)`);
          board.append(square);
        }
      } else {
        const square = el('div', pieces[char] ?? '', `display:grid;place-items:center;background:${(rank + file) % 2 === 0 ? '#edf2f7' : '#9bb4cf'};font-size:clamp(16px,5vw,29px);line-height:1;color:${char === char.toUpperCase() ? '#fff' : '#17243a'};text-shadow:${char === char.toUpperCase() ? '0 1px 2px #17243a,1px 0 1px #17243a' : 'none'}`);
        board.append(square);
        file++;
      }
    }
  });
  host.replaceChildren(board);
}
function showOpening(opening: Opening, host: HTMLElement): void {
  selectedEco = opening.eco;
  const card = el('article', '', style.card);
  const top = el('div', '', 'display:flex;align-items:flex-start;justify-content:space-between;gap:9px');
  const heading = el('div', '', 'min-width:0');
  heading.append(
    el('div', opening.name, 'font-size:15px;font-weight:850;color:#17243a;overflow-wrap:anywhere'),
    el('div', `ECO ${opening.eco} · ${opening.ply} ${t('nửa nước', 'plies')}`, style.muted),
  );
  top.append(heading, actionButton(isFavorite(opening) ? '★' : '☆', () => toggleFavorite(opening)));
  const boardHost = el('div');
  let frames: Array<{ fen: string; san: string }> = [{ fen: START_FEN, san: t('Vị trí ban đầu', 'Initial position') }];
  try { frames = [{ fen: START_FEN, san: t('Vị trí ban đầu', 'Initial position') }, ...replay(opening.moves).map((ply) => ({ fen: ply.fen, san: ply.san }))]; } catch { /* Show move text even if a legacy record cannot be replayed. */ }
  let frame = frames.length - 1;
  const moveLabel = el('div', '', 'text-align:center;color:#718096;font-size:12px;font-weight:650;margin:4px');
  const controls = el('div', '', 'display:flex;justify-content:center;align-items:center;gap:7px;flex-wrap:wrap');
  const prev = actionButton('←', () => { frame = Math.max(0, frame - 1); updateBoard(); });
  const next = actionButton('→', () => { frame = Math.min(frames.length - 1, frame + 1); updateBoard(); }, true);
  const start = actionButton(t('Đầu', 'Start'), () => { frame = 0; updateBoard(); });
  const end = actionButton(t('Cuối', 'End'), () => { frame = frames.length - 1; updateBoard(); });
  function updateBoard(): void {
    renderBoard(frames[frame]!.fen, boardHost);
    moveLabel.textContent = `${frame}/${frames.length - 1} · ${frames[frame]!.san}`;
    prev.disabled = frame === 0;
    next.disabled = frame === frames.length - 1;
    prev.style.opacity = prev.disabled ? '.4' : '1';
    next.style.opacity = next.disabled ? '.4' : '1';
  }
  controls.append(start, prev, next, end);
  const moves = el('pre', opening.pgn, 'white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8fc;padding:10px;border-radius:9px;color:#31445e;font:12px/1.65 ui-monospace,SFMono-Regular,monospace');
  const footer = el('div', '', 'display:flex;gap:7px;flex-wrap:wrap');
  footer.append(actionButton(t('Sao chép nước đi', 'Copy moves'), () => void copyText(opening.pgn)), actionButton('ECO', () => void copyText(opening.eco)));
  card.append(top, boardHost, moveLabel, controls, el('div', t('Biến chính', 'Main line'), 'font-weight:800;font-size:12px;margin:12px 0 5px;color:#31445e'), moves, footer);
  host.replaceChildren(card);
  updateBoard();
}
function renderExplorer(host: HTMLElement): void {
  const family = el('select', '', style.input);
  family.add(new Option(t('Tất cả nhóm ECO', 'All ECO groups'), ''));
  for (const group of ['A', 'B', 'C', 'D', 'E']) family.add(new Option(`ECO ${group}`, group));
  const count = el('p', '', style.muted);
  const results = el('div');
  const detail = el('div');
  let limit = 24;
  function update(): void {
    const query = searchInput.value.trim().toLowerCase();
    const matches = (family.value ? db.byEco(family.value) : db.all())
      .filter((opening) => !query || `${opening.eco} ${opening.name} ${opening.pgn}`.toLowerCase().includes(query));
    count.textContent = t(`Tìm thấy ${matches.length.toLocaleString()} khai cuộc · đang hiển thị tối đa ${Math.min(limit, matches.length)}`, `${matches.length.toLocaleString()} openings found · showing up to ${Math.min(limit, matches.length)}`);
    results.replaceChildren();
    for (const opening of matches.slice(0, limit)) {
      const row = el('div', '', 'display:flex;align-items:center;gap:7px;margin:5px 0');
      const item = actionButton('', () => showOpening(opening, detail));
      item.textContent = '';
      item.style.cssText += ';flex:1;min-width:0;text-align:left;white-space:normal;background:#fff;border-color:#e4eaf2;padding:10px';
      const eco = el('span', opening.eco, 'display:inline-block;min-width:38px;color:#1769d2;font-size:10px;font-weight:850');
      const name = el('span', opening.name, 'font-size:12px;font-weight:650;color:#26364d');
      item.append(eco, name);
      row.append(item, actionButton(isFavorite(opening) ? '★' : '☆', () => toggleFavorite(opening)));
      results.append(row);
    }
    if (matches.length > limit) results.append(actionButton(t('Hiện thêm 24', 'Load 24 more'), () => { limit += 24; update(); }));
    if (!matches.length) results.append(el('p', t('Không tìm thấy kết quả. Thử ECO hoặc tên khác.', 'No results. Try another ECO code or name.'), style.muted));
  }
  searchInput.oninput = () => { limit = 24; update(); };
  family.onchange = () => { limit = 24; update(); };
  host.append(makeSectionTitle(t('Opening Explorer', 'Opening Explorer'), t('Tra cứu thư viện khai cuộc và xem lại từng nước trên bàn cờ.', 'Search the opening library and replay each move on the board.')), searchInput, family, count, results, detail);
  update();
  if (selectedEco) {
    const selected = db.all().find((opening) => opening.eco === selectedEco);
    if (selected) showOpening(selected, detail);
  }
}
function renderAnalyzer(host: HTMLElement): void {
  const result = el('div');
  const controls = el('div', '', 'display:flex;gap:7px;flex-wrap:wrap;margin:8px 0');
  const analyze = actionButton(t('Phân tích PGN', 'Analyze PGN'), () => {
    const parsed = parsePgn(pgnInput.value);
    if (!parsed.moves.length) {
      result.replaceChildren(el('p', t('Không đọc được nước đi SAN hợp lệ. Kiểm tra lại PGN nhé.', 'No valid SAN moves found. Please check the PGN.'), `color:${palette.amber};font-size:12px`));
      return;
    }
    const detection = detectOpening(db, parsed.moves, parsed.headers['FEN']);
    if (!detection) {
      result.replaceChildren(el('p', t('Không tìm thấy vị trí khai cuộc khớp. Có thể ván bắt đầu từ FEN khác hoặc PGN không hợp lệ.', 'No matching opening position. The game may start from a different FEN or contain invalid moves.'), style.muted));
      return;
    }
    const card = el('article', '', style.card);
    card.append(
      el('div', `${detection.opening.eco} · ${detection.opening.name}`, 'font-size:15px;font-weight:850;color:#1769d2'),
      el('p', `${t('Khớp tại nước thứ', 'Matched at ply')} ${detection.ply}/${parsed.moves.length} · ${detection.exact ? t('khớp toàn bộ', 'exact line') : t('khớp sâu nhất', 'deepest match')}`, style.muted),
      el('p', `${t('Số nước đọc được', 'Moves parsed')}: ${parsed.moves.length} · ${t('Kết quả', 'Result')}: ${parsed.result}`, style.muted),
      actionButton(t('Mở trong Explorer', 'Open in Explorer'), () => { activeTab = 'explorer'; renderContent(); }),
      actionButton(isFavorite(detection.opening) ? '★ Saved' : '☆ Save', () => toggleFavorite(detection.opening)),
    );
    result.replaceChildren(card);
    selectedEco = detection.opening.eco;
  }, true);
  controls.append(analyze, actionButton(t('Sao chép PGN', 'Copy PGN'), () => void copyText(pgnInput.value)), actionButton(t('Xóa', 'Clear'), () => { pgnInput.value = ''; result.replaceChildren(); }));
  host.append(makeSectionTitle('PGN Analyzer', t('Dán ván đã kết thúc để nhận diện khai cuộc sâu nhất. Không hỗ trợ nước đi trong trận đang diễn ra.', 'Paste a completed game to identify its deepest matching opening. No live-game move assistance.')), pgnInput, controls, result);
}
function renderFavorites(host: HTMLElement): void {
  const saved = getFavorites();
  const list = el('div');
  const detail = el('div');
  for (const eco of saved) {
    const opening = db.all().find((item) => item.eco === eco);
    if (!opening) continue;
    const item = actionButton(`${opening.eco} · ${opening.name}`, () => showOpening(opening, detail));
    item.style.cssText += ';display:block;width:100%;text-align:left;margin:5px 0;white-space:normal';
    list.append(item);
  }
  if (!saved.length) list.append(el('p', t('Chưa có khai cuộc nào được lưu. Nhấn ☆ trong Explorer để lưu.', 'No saved openings yet. Use ☆ in Explorer to save one.'), style.muted));
  host.append(makeSectionTitle(t('Bộ sưu tập của mày', 'Your collection'), t(`${saved.length} khai cuộc đã lưu trên thiết bị này.`, `${saved.length} openings saved on this device.`)), list, detail);
  if (saved.length) host.append(actionButton(t('Xóa toàn bộ đã lưu', 'Clear saved openings'), () => {
    if (confirm(t('Xóa toàn bộ danh sách đã lưu?', 'Clear all saved openings?'))) {
      safeStorageSet(KEYS.favorites, '[]');
      renderContent();
    }
  }));
}
function renderLiveDetector(host: HTMLElement): void {
  stopLiveMonitor();
  const siteLabel = location.hostname.includes('lichess.org') ? 'Lichess' : 'Chess.com';
  const banner = el('div', '', 'padding:11px 12px;border:1px solid #b8d7fb;border-radius:11px;background:#eff6ff;color:#174b83;font-size:12px;line-height:1.55');
  banner.append(
    el('div', '● LIVE · READ-ONLY', 'font-size:11px;font-weight:900;letter-spacing:.7px;color:#1769d2'),
    el('div', t('Đang đồng bộ ván cờ từ ' + siteLabel + '. Bàn cờ OPMAS cập nhật theo sự kiện nước đi; chỉ nhận diện khai cuộc.', 'Synchronizing the game from ' + siteLabel + '. OPMAS board updates on move events; opening identification only.')),
  );
  const status = el('div', t('Đang chờ dữ liệu nước đi…', 'Waiting for move data…'), style.muted);
  const result = el('div');
  const boardHost = el('div');
  const boardCaption = el('div', t('Bàn cờ đồng bộ', 'Synchronized board'), 'font-size:12px;font-weight:850;margin:12px 0 4px;color:#31445e');
  const boardMeta = el('div', t('Chưa có vị trí ván cờ.', 'No game position yet.'), style.muted);
  const moveLine = el('pre', '', 'white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;border-radius:9px;background:#f5f8fc;color:#31445e;font:12px/1.7 ui-monospace,SFMono-Regular,monospace');
  const refresh = actionButton(t('Làm mới', 'Refresh'), () => update(), true);
  const details = el('div');
  host.append(
    makeSectionTitle(t('Live Opening Detector', 'Live Opening Detector'), t('Tự lấy ván từ URL Lichess, đưa vị trí hiện tại lên bàn OPMAS và theo dõi biến thể theo từng nước.', 'Reads the Lichess game from its URL, mirrors the current position on the OPMAS board, and tracks the opening move by move.')),
    banner, status, result, boardCaption, boardHost, boardMeta,
    el('div', t('Lịch sử nước đi đọc được', 'Detected move history'), 'font-size:12px;font-weight:800;margin:12px 0 5px;color:#31445e'),
    moveLine, refresh, details,
  );

  let lastSignature = '';
  let lastFen = START_FEN;
  function update(): void {
    if (panel.style.display === 'none') return;
    const live = readLiveMoves(document, location.href);
    if (!live) {
      status.textContent = t('Không nhận diện được trang bàn cờ được hỗ trợ.', 'This is not a supported chess-board page.');
      return;
    }
    const signature = live.moves.join(' ');
    if (signature === lastSignature) return;
    lastSignature = signature;
    moveLine.textContent = signature || t('Chưa đọc được nước đi. Mở move list hoặc đợi trang tải xong.', 'No moves detected yet. OPMAS will retry automatically.');
    status.textContent = live.moves.length
      ? t('Đã đồng bộ ' + live.moves.length + ' nửa nước từ ' + siteLabel + '.', 'Synchronized ' + live.moves.length + ' plies from ' + siteLabel + '.')
      : t('Chưa có dữ liệu move list. OPMAS sẽ chờ sự kiện DOM tiếp theo.', 'No move-list data yet. OPMAS is waiting for the next DOM event.');

    // Replay the actual game moves onto OPMAS's own board.
    try {
      const frames = replay(live.moves);
      const latest = frames[frames.length - 1];
      if (latest?.fen) {
        lastFen = latest.fen;
        renderBoard(lastFen, boardHost);
        boardMeta.textContent = t('Vị trí hiện tại · ' + live.moves.length + ' nửa nước · lượt ' + (live.moves.length % 2 === 0 ? 'Trắng' : 'Đen'), 'Current position · ' + live.moves.length + ' plies · ' + (live.moves.length % 2 === 0 ? 'White' : 'Black') + ' to move');
      } else {
        renderBoard(lastFen, boardHost);
      }
    } catch {
      boardMeta.textContent = t('Đã đọc nước đi nhưng chưa dựng được vị trí bàn cờ (có thể SAN chưa đầy đủ).', 'Moves were read, but the board position could not be replayed (SAN may be incomplete).');
    }

    result.replaceChildren();
    details.replaceChildren();
    if (!live.moves.length) return;

    const detection = detectOpening(db, live.moves);
    if (!detection) {
      result.append(el('div', t('Chưa khớp khai cuộc trong thư viện OPMAS.', 'No matching opening found in the OPMAS library.'), 'padding:12px;border:1px solid #f1dfb9;border-radius:10px;background:#fffaf0;color:' + palette.amber + ';font-size:12px'));
      return;
    }
    const card = el('article', '', style.card);
    const afterTheory = live.moves.slice(detection.ply);
    const openingFinished = detection.ply >= detection.opening.ply && live.moves.length > detection.opening.ply;
    if (openingFinished) boardMeta.textContent = t('✓ ĐÃ HOÀN THÀNH PHẦN KHAI CUỘC · vị trí hiện tại vẫn được đồng bộ', '✓ OPENING PHASE COMPLETED · board position remains synchronized');
    card.append(
      el('div', detection.opening.name, 'font-size:16px;font-weight:900;color:#17243a'),
      el('div', 'ECO ' + detection.opening.eco + ' · ' + detection.opening.ply + ' ' + t('nửa nước lý thuyết', 'theory plies'), 'margin-top:4px;color:#1769d2;font-size:12px;font-weight:800'),
      el('p', detection.exact
        ? t('Khớp chính xác với dòng khai cuộc trong cơ sở dữ liệu.', 'Exact match with a line in the opening database.')
        : t('Đây là vị trí khớp sâu nhất tìm được; ván có thể đã chuyển sang biến phụ hoặc chuyển vị.', 'Deepest matching position found; the game may have entered a side variation or transposition.'), style.muted),
    );
    if (openingFinished) {
      card.append(el('div', '✓ ' + t('ĐÃ HOÀN THÀNH PHẦN KHAI CUỘC', 'OPENING PHASE COMPLETED'), 'padding:10px;margin:9px 0;border:1px solid #a7dfc8;border-radius:9px;background:#edfaf4;color:#08734f;font-size:12px;font-weight:900;letter-spacing:.3px'));
    } else {
      card.append(el('div', t('Đang trong phần khai cuộc…', 'Opening phase in progress…'), 'padding:9px;margin:9px 0;border-radius:8px;background:#f5f8fc;color:#53657c;font-size:12px;font-weight:750'));
    }
    card.append(el('div', afterTheory.length
      ? t('Sau đoạn lý thuyết đã khớp: ' + afterTheory.join(' '), 'Moves after matched theory: ' + afterTheory.join(' '))
      : t('Chưa có nước đi vượt khỏi đoạn lý thuyết được nhận diện.', 'No moves beyond the detected theory line yet.'), 'padding:9px;border-radius:8px;background:#f5f8fc;color:#31445e;font-size:11px;line-height:1.6'));
    card.append(actionButton(t('Lưu khai cuộc', 'Save opening'), () => {
      const favorites = getFavorites();
      if (!favorites.includes(detection.opening.eco)) {
        safeStorageSet(KEYS.favorites, JSON.stringify([...favorites, detection.opening.eco]));
        setNotice(t('Đã lưu khai cuộc vào bộ sưu tập.', 'Opening saved to your collection.'));
      } else setNotice(t('Khai cuộc đã được lưu rồi.', 'Opening is already saved.'));
    }));
    result.append(card);
  }

  // MutationObserver is the primary event-driven source; the interval is a slow fallback.
  update();
  liveObserver = new MutationObserver(() => update());
  if (document.body) liveObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  liveRefreshTimer = window.setInterval(update, 2500);
}
function renderContent(): void {
  content.replaceChildren(makeTabs());
  if (liveMode) {
    const view = el('div');
    content.append(view);
    renderLiveDetector(view);
    return;
  }
  if (!gateAllowed) {
    const warning = el('div', t('OPMAS đang khóa trên trang chơi. Hãy mở trang phân tích hoặc thư viện sau khi ván đấu kết thúc.', 'OPMAS is locked on play pages. Open the analysis or library page after the game ends.'), 'padding:13px;border:1px solid #f4d7a2;border-radius:11px;background:#fff8e9;color:#87520c;font-size:12px;line-height:1.5');
    content.append(warning);
    return;
  }
  const view = el('div');
  content.append(view);
  if (activeTab === 'explorer') renderExplorer(view);
  else if (activeTab === 'analyzer') renderAnalyzer(view);
  else renderFavorites(view);
}
async function render(focus: 'search' | 'pgn' | null = null): Promise<void> {
  const token = ++renderToken;
  panel.replaceChildren(makeHeader(), notice, content);
  const isSupportedGame = !!parseGameUrl(location.href) || isPlayContext(location.href);
  const gate = isSupportedGame ? { allowed: false as const, reason: 'game-in-progress' as const } : await checkGate(location.href, fetchStatus);
  if (token !== renderToken) return;
  liveMode = isSupportedGame;
  gateAllowed = gate.allowed;
  const status = el('div', '', 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:9px;background:#f5f8fc;color:#718096;font-size:11px');
  status.append(el('span', `${db.size.toLocaleString()} ${t('khai cuộc trong thư viện', 'openings in library')}`), el('span', liveMode ? '● LIVE · READ-ONLY' : gateAllowed ? '● Ready' : '● Locked', `font-weight:800;color:${liveMode ? palette.blue : gateAllowed ? palette.green : palette.amber}`));
  panel.insertBefore(status, content);
  renderContent();
  if (focus === 'search' && activeTab === 'explorer') searchInput.focus();
  if (focus === 'pgn' && activeTab === 'analyzer') pgnInput.focus();
}

launcher.onclick = () => panel.style.display === 'none' ? openPanel() : closePanel();
const mount = el('div');
mount.id = 'opmas-shadow-host';
mount.style.cssText = 'all:initial!important;display:block!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483647!important;pointer-events:none!important;contain:none!important;transform:none!important';
const shadow = mount.attachShadow({ mode: 'open' });
const shadowStyle = el('style');
shadowStyle.textContent = `
  :host { all:initial!important; }
  *,*::before,*::after { box-sizing:border-box; }
  button,input,textarea,select { font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
  button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible { outline:3px solid #8dbdff!important;outline-offset:2px!important; }
  input:focus,textarea:focus,select:focus { border-color:#1769d2!important;box-shadow:0 0 0 3px #1769d21c!important; }
  @media(max-width:520px) {
    #opmas-panel { top:8px!important;right:8px!important;left:8px!important;width:auto!important;max-height:calc(100vh - 72px)!important; }
    #opmas-launcher { right:12px!important;bottom:12px!important; }
  }
`;
shadow.append(shadowStyle, panel, launcher);

let mounted = false;
function ensureMounted(): void {
  if (!document.documentElement || mount.isConnected) return;
  document.documentElement.append(mount);
  if (!mounted) { mounted = true; console.info('[OPMAS] launcher mounted'); }
}
let mountObserverStarted = false;
const mountObserver = new MutationObserver(() => ensureMounted());
function bootMount(): void {
  ensureMounted();
  if (document.documentElement && !mountObserverStarted) {
    mountObserverStarted = true;
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMount, { once: true });
else bootMount();
window.addEventListener('pageshow', ensureMounted);
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.style.display !== 'none') closePanel(); });

if (registerMenu) {
  registerMenu('♞ OPMAS — Open Explorer', () => openPanel('explorer', 'search'));
  registerMenu('OPMAS — Analyze PGN', () => openPanel('analyzer', 'pgn'));
  registerMenu('OPMAS — Saved openings', () => openPanel('favorites'));
  registerMenu('OPMAS — Close GUI', closePanel);
}
let lastUrl = location.href;
window.setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    stopLiveMonitor();
    if (panel.style.display !== 'none') void render();
  }
}, 1200);
