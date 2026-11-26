import { useEffect, useMemo, useState } from 'react';
import openingsUrl from '../../../data/openings/openings.json?url';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { replay, START_FEN } from '@opmas/chess-core';
import { Board } from '@opmas/ui-components';

const API_BASE = (import.meta as ImportMeta & { env: { VITE_OPMAS_API_URL?: string } }).env.VITE_OPMAS_API_URL?.replace(/\/$/, '') ?? '';
type Route = 'explorer' | 'analyzer' | 'about' | 'live';

function useRoute(): Route {
  const read = (): Route => {
    const route = location.hash.replace(/^#\/?/, '').split('?')[0];
    return route === 'analyzer' || route === 'about' || route === 'live' ? route : 'explorer';
  };
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function positionsFor(moves: string[]): string[] {
  try {
    return [START_FEN, ...replay(moves).map((ply) => ply.fen)];
  } catch {
    return [START_FEN];
  }
}

function Explorer({ db }: { db: OpeningDatabase }) {
  const [query, setQuery] = useState('');
  const [eco, setEco] = useState('all');
  const [selected, setSelected] = useState<Opening>(db.all()[0]!);
  const [ply, setPly] = useState(0);
  const [apiState, setApiState] = useState<'local' | 'checking' | 'online' | 'offline'>(API_BASE ? 'checking' : 'local');

  useEffect(() => {
    if (!API_BASE) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json() as Promise<{ ok: boolean }>;
      })
      .then((health) => setApiState(health.ok ? 'online' : 'offline'))
      .catch(() => setApiState('offline'));
    return () => controller.abort();
  }, []);

  const ecoGroups = useMemo(() => [...new Set(db.all().map((opening) => opening.eco))].sort(), []);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return db.all().filter((opening) => {
      const matchesEco = eco === 'all' || opening.eco.startsWith(eco);
      const matchesQuery = !normalized || `${opening.eco} ${opening.name} ${opening.pgn}`.toLocaleLowerCase().includes(normalized);
      return matchesEco && matchesQuery;
    }).slice(0, 250);
  }, [query, eco]);

  const positions = useMemo(() => positionsFor(selected.moves), [selected]);
  const currentFen = positions[Math.min(ply, positions.length - 1)] ?? START_FEN;
  const related = useMemo(() => db.all()
    .filter((opening) => opening.eco === selected.eco && opening.pgn !== selected.pgn)
    .slice(0, 8), [selected]);

  function chooseOpening(opening: Opening) {
    setSelected(opening);
    setPly(0);
  }

  return (
    <div className="explorer-page">
      <section className="page-intro">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> OPENING INTELLIGENCE</div>
          <h1>Opening Explorer</h1>
          <p>Khám phá, tìm kiếm và nghiên cứu các dòng khai cuộc trong cơ sở dữ liệu OPMAS.</p>
        </div>
        <div className="database-pill"><span className="status-dot" /> {db.size.toLocaleString('vi-VN')} openings</div>
      </section>

      <section className="stats-grid" aria-label="Database statistics">
        <article className="stat-card"><span className="stat-label">Tổng khai cuộc</span><strong>{db.size.toLocaleString('vi-VN')}</strong><span className="stat-note">Dữ liệu đã được lập chỉ mục</span></article>
        <article className="stat-card"><span className="stat-label">Mã ECO</span><strong>{ecoGroups.length}</strong><span className="stat-note">Nhóm phân loại khai cuộc</span></article>
        <article className="stat-card"><span className="stat-label">Đang xem</span><strong>{selected.eco}</strong><span className="stat-note">Mã ECO được chọn</span></article>
        <article className="stat-card"><span className="stat-label">Nguồn dữ liệu</span><strong className="stat-source">{apiState === 'online' ? 'API Live' : apiState === 'offline' ? 'Local mode' : apiState === 'checking' ? 'Checking…' : 'Local DB'}</strong><span className="stat-note">{apiState === 'online' ? 'Đã kết nối API OPMAS' : 'Có thể dùng không cần backend'}</span></article>
      </section>

      <section className="explorer-layout">
        <aside className="panel opening-browser">
          <div className="panel-heading">
            <div><span className="panel-kicker">LIBRARY</span><h2>Thư viện khai cuộc</h2></div>
            <span className="result-count">{filtered.length}{filtered.length === 250 ? '+' : ''}</span>
          </div>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, ECO hoặc nước đi…" aria-label="Tìm kiếm khai cuộc" />
            {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Xóa tìm kiếm">×</button>}
          </label>
          <label className="filter-label" htmlFor="eco-filter">Lọc theo mã ECO</label>
          <select id="eco-filter" value={eco} onChange={(event) => setEco(event.target.value)}>
            <option value="all">Tất cả nhóm ECO</option>
            {['A', 'B', 'C', 'D', 'E'].map((group) => <option key={group} value={group}>{group} — {group === 'A' ? 'Flank openings' : group === 'B' ? 'Semi-open games' : group === 'C' ? 'Open games' : group === 'D' ? 'Closed games' : 'Indian defenses'}</option>)}
          </select>
          <div className="opening-list" role="list" aria-label="Kết quả khai cuộc">
            {filtered.map((opening) => (
              <button className={selected.pgn === opening.pgn ? 'opening-row active' : 'opening-row'} key={`${opening.eco}-${opening.pgn}`} onClick={() => chooseOpening(opening)} role="listitem">
                <span className="eco-tag">{opening.eco}</span>
                <span className="opening-row-copy"><strong>{opening.name}</strong><small>{opening.pgn}</small></span>
                <span className="row-chevron">›</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="empty-state"><span>⌕</span><strong>Không tìm thấy khai cuộc</strong><p>Thử từ khóa hoặc nhóm ECO khác.</p></div>}
          </div>
          <p className="list-footnote">Hiển thị tối đa 250 kết quả để giữ Explorer mượt.</p>
        </aside>

        <div className="detail-column">
          <section className="panel opening-detail">
            <div className="detail-topline"><span className="eco-tag large">{selected.eco}</span><span className="detail-label">OPENING PROFILE</span></div>
            <h2>{selected.name}</h2>
            <p className="opening-notation">{selected.pgn}</p>
            <div className="detail-meta"><span><b>{selected.ply}</b> half-moves</span><span><b>{selected.moves.length}</b> moves</span><span><b>{selected.eco}</b> ECO code</span></div>
          </section>

          <section className="panel board-panel">
            <div className="panel-heading board-heading"><div><span className="panel-kicker">POSITION VIEWER</span><h2>Bàn cờ khai cuộc</h2></div><span className="move-counter">{ply} / {selected.moves.length}</span></div>
            <div className="board-and-controls">
              <div className="board-wrap"><Board fen={currentFen} /></div>
              <div className="board-side">
                <span className="side-label">CURRENT POSITION</span>
                <strong>{ply === 0 ? 'Starting position' : selected.moves[ply - 1]}</strong>
                <p>{ply === selected.moves.length ? 'Đã đến nước cuối của dòng khai cuộc.' : 'Dùng các nút bên dưới để duyệt từng nước đi.'}</p>
                <div className="board-controls">
                  <button onClick={() => setPly(0)} disabled={ply === 0} aria-label="Về đầu">⟲</button>
                  <button onClick={() => setPly((value) => Math.max(0, value - 1))} disabled={ply === 0} aria-label="Nước trước">‹</button>
                  <button onClick={() => setPly((value) => Math.min(selected.moves.length, value + 1))} disabled={ply >= selected.moves.length} aria-label="Nước tiếp">›</button>
                  <button onClick={() => setPly(selected.moves.length)} disabled={ply === selected.moves.length} aria-label="Đến cuối">⤓</button>
                </div>
              </div>
            </div>
            <div className="move-strip" aria-label="Danh sách nước đi">
              {selected.moves.map((move, index) => <button key={index} className={ply === index + 1 ? 'move-chip current' : 'move-chip'} onClick={() => setPly(index + 1)}>{index % 2 === 0 && <span>{Math.floor(index / 2) + 1}.</span>}{move}</button>)}
            </div>
          </section>

          <section className="panel variations-panel">
            <div className="panel-heading"><div><span className="panel-kicker">RELATED LINES</span><h2>Các dòng liên quan</h2></div><span className="result-count">{related.length}</span></div>
            {related.length ? <div className="related-list">{related.map((opening) => <button key={opening.pgn} onClick={() => chooseOpening(opening)}><span className="eco-tag">{opening.eco}</span><span><strong>{opening.name}</strong><small>{opening.pgn}</small></span><span className="row-chevron">›</span></button>)}</div> : <p className="muted-copy">Chưa có biến thể cùng mã ECO trong tập dữ liệu này.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}

function Analyzer({ db }: { db: OpeningDatabase }) {
  const [pgn, setPgn] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('pgn') ?? '');
  const parsed = useMemo(() => parsePgn(pgn), [pgn]);
  const detection = useMemo(() => pgn.trim() ? detectOpening(db, parsed.moves, parsed.headers['FEN']) : null, [pgn, parsed.moves, parsed.headers['FEN']]);
  const positions = useMemo(() => {
    try { return [parsed.headers['FEN'] ?? START_FEN, ...replay(parsed.moves, parsed.headers['FEN']).map((move) => move.fen)]; }
    catch { return [START_FEN]; }
  }, [parsed.moves, parsed.headers['FEN']]);
  const [ply, setPly] = useState(0);
  const [gameFinishedConfirmed, setGameFinishedConfirmed] = useState(false);
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineProgress, setEngineProgress] = useState(0);
  const [engineError, setEngineError] = useState('');
  const [engineRows, setEngineRows] = useState<Array<{ ply: number; move: string; loss: number; label: string }>>([]);
  useEffect(() => setPly(0), [pgn]);
  const validReplay = positions.length === parsed.moves.length + 1;
  const hasFinalResult = /(?:\\[Result\\s+"(?:1-0|0-1|1\\/2-1\\/2)"\\]|(?:1-0|0-1|1\\/2-1\\/2)\\s*$)/m.test(pgn);
  const canRunEngine = gameFinishedConfirmed && hasFinalResult && validReplay && parsed.moves.length > 1;

  async function runStockfishReview() {
    if (!canRunEngine || engineBusy) return;
    setEngineBusy(true);
    setEngineError('');
    setEngineRows([]);
    setEngineProgress(0);
    try {
      // Post-game only: evaluate a bounded number of positions, never the live board.
      const fens = positions.slice(0, Math.min(positions.length, 41));
      const scores: number[] = [];
      for (let index = 0; index < fens.length; index += 1) {
        const endpoint = new URL('https://stockfish.online/api/s/v2.php');
        endpoint.searchParams.set('fen', fens[index]!);
        endpoint.searchParams.set('depth', '12');
        endpoint.searchParams.set('mode', 'eval');
        const response = await fetch(endpoint.toString());
        if (!response.ok) throw new Error(`Stockfish API HTTP ${response.status}`);
        const data = await response.json() as { success?: boolean; evaluation?: number; eval?: number; mate?: number | null; data?: string };
        if (data.success === false) throw new Error(data.data || 'Stockfish không phân tích được vị trí này.');
        let score = typeof data.evaluation === 'number' ? data.evaluation : typeof data.eval === 'number' ? data.eval : Number.NaN;
        if (!Number.isFinite(score) && typeof data.mate === 'number') score = data.mate > 0 ? 99 : data.mate < 0 ? -99 : 0;
        if (!Number.isFinite(score)) throw new Error('API không trả về evaluation hợp lệ.');
        scores.push(score);
        setEngineProgress(index + 1);
        if (index < fens.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      const rows = parsed.moves.slice(0, scores.length - 1).map((move, index) => {
        const loss = Math.max(0, index % 2 === 0 ? scores[index]! - scores[index + 1]! : scores[index + 1]! - scores[index]!);
        const label = loss <= 0.08 ? 'Best' : loss <= 0.25 ? 'Excellent' : loss <= 0.5 ? 'Good' : loss <= 1 ? 'Inaccuracy' : loss <= 2 ? 'Mistake' : 'Blunder';
        return { ply: index + 1, move, loss, label };
      });
      setEngineRows(rows);
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Không thể kết nối Stockfish.');
    } finally {
      setEngineBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> GAME ANALYSIS</div><h1>PGN Analyzer</h1><p>Dán PGN để nhận diện khai cuộc và phát lại ván cờ.</p></div></div>
      <section className="analyzer-grid">
        <div className="panel analyzer-input"><div className="panel-heading"><div><span className="panel-kicker">INPUT</span><h2>PGN notation</h2></div></div>
          <textarea value={pgn} onChange={(event) => setPgn(event.target.value)} placeholder={'[Event "Casual game"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6'} rows={12} aria-label="PGN input" />
          <div className="input-footer"><span>{parsed.moves.length} nước đi đã nhận diện</span><button className="text-button" onClick={() => setPgn('')}>Xóa nội dung</button></div>
          {pgn.trim() && <div className="detection-result">{detection ? <><span className="success-icon">✓</span><div><small>OPENING DETECTED</small><strong>{detection.opening.eco} · {detection.opening.name}</strong><p>{detection.opening.pgn}</p></div></> : <><span className="neutral-icon">i</span><div><small>NO MATCH</small><strong>Chưa nhận diện được khai cuộc</strong><p>Thử PGN khác hoặc kiểm tra định dạng nước đi.</p></div></>}</div>}
        </div>
        <div className="panel analyzer-board"><div className="panel-heading"><div><span className="panel-kicker">REPLAY</span><h2>Ván cờ</h2></div><span className="move-counter">{ply} / {parsed.moves.length}</span></div>
          <div className="board-wrap"><Board fen={positions[Math.min(ply, positions.length - 1)] ?? START_FEN} /></div>
          <div className="board-controls centered"><button onClick={() => setPly(0)} disabled={ply === 0}>⟲</button><button onClick={() => setPly((value) => Math.max(0, value - 1))} disabled={ply === 0}>‹</button><button onClick={() => setPly((value) => Math.min(parsed.moves.length, value + 1))} disabled={!validReplay || ply >= parsed.moves.length}>›</button><button onClick={() => setPly(parsed.moves.length)} disabled={!validReplay || ply === parsed.moves.length}>⤓</button></div>
          {!validReplay && parsed.moves.length > 0 && <p className="error-copy">Không thể phát lại toàn bộ nước đi. Kiểm tra PGN hoặc FEN bắt đầu.</p>}
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-heading"><div><span className="panel-kicker">STOCKFISH · POST-GAME</span><h2>Đánh giá nước đi</h2></div><span className="result-count">Depth 12</span></div>
        <p className="muted-copy">Stockfish đánh giá các vị trí sau khi ván đã kết thúc. Mỗi nước được xếp theo độ hụt điểm ước tính; đây là phân loại tham khảo, không phải nhãn Brilliant chính thức.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '13px 0', color: 'var(--ink)', fontSize: 12 }}>
          <input type="checkbox" checked={gameFinishedConfirmed} onChange={(event) => setGameFinishedConfirmed(event.target.checked)} />
          Tao xác nhận PGN này là ván đã kết thúc.
        </label>
        {!hasFinalResult && <p className="error-copy">PGN cần có kết quả cuối ván (1-0, 0-1 hoặc 1/2-1/2), không dùng dấu *.</p>}
        <button className="download-link" disabled={!canRunEngine || engineBusy} onClick={() => void runStockfishReview()} style={{ border: 0, cursor: canRunEngine && !engineBusy ? 'pointer' : 'not-allowed', opacity: canRunEngine && !engineBusy ? 1 : .5 }}>
          {engineBusy ? `Stockfish đang phân tích ${engineProgress}/${Math.min(positions.length, 41)}…` : 'Phân tích ván đã kết thúc bằng Stockfish'}
        </button>
        {positions.length > 41 && <p className="muted-copy">Giới hạn 40 nửa nước đầu tiên mỗi lượt phân tích để tránh gửi quá nhiều yêu cầu.</p>}
        {engineError && <p className="error-copy">{engineError}. API bên ngoài có thể đang bận hoặc chặn yêu cầu từ trình duyệt.</p>}
        {engineRows.length > 0 && <div className="related-list" style={{ marginTop: 12 }}>
          {engineRows.map((row) => <div key={row.ply} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
            <span><b>{Math.ceil(row.ply / 2)}{row.ply % 2 ? '.' : '...'}</b> {row.move}</span>
            <span style={{ color: row.label === 'Blunder' ? '#b42318' : row.label === 'Mistake' ? '#a86610' : 'var(--ink)' }}>{row.label} · {row.loss.toFixed(2)}</span>
          </div>)}
        </div>}
        <p className="muted-copy" style={{ marginTop: 10 }}>Chỉ gửi FEN của từng vị trí đến Stockfish Online; PGN đầy đủ không được gửi. Không có phân tích engine trong trận đang diễn ra.</p>
      </section>
    </div>
  );
}


function LiveHelp() {
  return (
    <div className="tool-page">
      <div className="page-intro">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> LIVE GAME COMPANION</div><h1>Live Game Helper</h1><p>Đồng bộ bàn cờ và nhận diện khai cuộc bằng OPMAS Userscript.</p></div>
      </div>
      <section className="about-grid">
        <article className="panel">
          <span className="panel-kicker">01 · INSTALL</span><strong>Userscript</strong><h2>Cài OPMAS lên trình duyệt</h2>
          <p>Cài Tampermonkey hoặc Violentmonkey, sau đó tải userscript và bật tiện ích. Đây là phần có quyền đọc trang Chess.com/Lichess hiện tại.</p>
          <a className="download-link" href={import.meta.env.BASE_URL + 'opmas.user.js'} download>Tải OPMAS Userscript ↓</a>
        </article>
        <article className="panel">
          <span className="panel-kicker">02 · SAME TAB</span><strong>Read-only</strong><h2>Đồng bộ ván đang chơi</h2>
          <p>Mở ván trên Chess.com hoặc Lichess trong cùng tab đã cài userscript, nhấn nút OPMAS rồi chọn “Ván đang chơi”. Công cụ chỉ đọc lịch sử nước đi, dựng bàn cờ riêng và nhận diện khai cuộc; không can thiệp bàn cờ hoặc gợi ý nước đi.</p>
        </article>
        <article className="panel">
          <span className="panel-kicker">03 · WEBSITE</span><strong>PGN</strong><h2>Phân tích trên website</h2>
          <p>Trang web độc lập không thể tự đọc tab Chess.com/Lichess do giới hạn bảo mật giữa các website. Dán PGN vào PGN Analyzer để phát lại bàn cờ và tra cứu khai cuộc.</p>
          <a className="inline-link" href="#/analyzer">Mở PGN Analyzer →</a>
        </article>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-heading"><div><span className="panel-kicker">SUPPORTED SITES</span><h2>Mở nền tảng cờ vua</h2></div></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="github-link" href="https://lichess.org/" target="_blank" rel="noreferrer">Lichess ↗</a>
          <a className="github-link" href="https://www.chess.com/" target="_blank" rel="noreferrer">Chess.com ↗</a>
        </div>
      </section>
    </div>
  );
}

function About({ db }: { db: OpeningDatabase }) {
  return <div className="tool-page"><div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> OPEN SOURCE CHESS TOOLS</div><h1>About OPMAS</h1><p>Opening Master là bộ công cụ mã nguồn mở để khám phá, nhận diện và nghiên cứu khai cuộc cờ vua.</p></div></div><section className="about-grid"><article className="panel"><span className="panel-kicker">DATABASE</span><strong>{db.size.toLocaleString('vi-VN')}</strong><h2>Opening lines</h2><p>Thư viện khai cuộc được lập chỉ mục theo ECO, tên và chuỗi nước đi.</p></article><article className="panel"><span className="panel-kicker">OPEN SOURCE</span><strong>MIT</strong><h2>Built in public</h2><p>Đóng góp mã nguồn, báo lỗi hoặc đề xuất tính năng trên GitHub.</p><a className="inline-link" href="https://github.com/VoNguyenPhong-Kids11Ages/OPMAS" target="_blank" rel="noreferrer">Xem repository ↗</a></article><article className="panel"><span className="panel-kicker">INTEGRATIONS</span><strong>2</strong><h2>Chess platforms</h2><p>Hệ sinh thái OPMAS có userscript hỗ trợ Chess.com và Lichess.</p></article></section></div>;
}

export function App() {
  const route = useRoute();
  const [db, setDb] = useState<OpeningDatabase | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(openingsUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Opening database request failed: ${response.status}`);
        return response.json() as Promise<Opening[]>;
      })
      .then((records) => setDb(new OpeningDatabase(records)))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar"><a className="brand" href="#/explorer"><span className="brand-mark">O</span><span>OPMAS<small>OPENING MASTER</small></span></a><nav className="main-nav" aria-label="Main navigation"><a href="#/explorer" aria-current={route === 'explorer' ? 'page' : undefined}>Explorer</a><a href="#/analyzer" aria-current={route === 'analyzer' ? 'page' : undefined}>PGN Analyzer</a><a href="#/live" aria-current={route === 'live' ? 'page' : undefined}>Live Help</a><a href="#/about" aria-current={route === 'about' ? 'page' : undefined}>About</a></nav><div className="header-actions"><a className="download-link" href={`${import.meta.env.BASE_URL}opmas.user.js`} download>Tải userscript ↓</a><a className="github-link" href="https://github.com/VoNguyenPhong-Kids11Ages/OPMAS" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
      <main>
        {!db ? (
          <section className="panel" role="status" style={{ margin: '48px auto', maxWidth: 680, padding: 28 }}>
            <h1>{loadError ? 'Không tải được dữ liệu khai cuộc' : 'Đang tải OPMAS…'}</h1>
            <p>{loadError ? 'Kiểm tra kết nối rồi tải lại trang. Cơ sở dữ liệu được phục vụ như một tệp riêng để website tải nhanh hơn.' : 'Đang nạp thư viện khai cuộc.'}</p>
            {loadError && <button onClick={() => location.reload()}>Thử lại</button>}
          </section>
        ) : route === 'analyzer' ? <Analyzer db={db} /> : route === 'live' ? <LiveHelp /> : route === 'about' ? <About db={db} /> : <Explorer db={db} />}
      </main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} OPMAS · Opening Master</span><span>Open source chess intelligence</span></footer>
    </div>
  );
}
