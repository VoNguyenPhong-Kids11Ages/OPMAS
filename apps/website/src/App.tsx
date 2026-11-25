import { useEffect, useMemo, useState } from 'react';
import openings from '../../../data/openings/openings.json';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';
import { replay, START_FEN } from '@opmas/chess-core';
import { Board } from '@opmas/ui-components';

const db = new OpeningDatabase(openings as Opening[]);
const API_BASE = (import.meta as ImportMeta & { env: { VITE_OPMAS_API_URL?: string } }).env.VITE_OPMAS_API_URL?.replace(/\/$/, '') ?? '';
type Route = 'explorer' | 'analyzer' | 'about';

function useRoute(): Route {
  const read = (): Route => {
    const route = location.hash.replace(/^#\/?/, '');
    return route === 'analyzer' || route === 'about' ? route : 'explorer';
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

function Explorer() {
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

function Analyzer() {
  const [pgn, setPgn] = useState('');
  const parsed = useMemo(() => parsePgn(pgn), [pgn]);
  const detection = useMemo(() => pgn.trim() ? detectOpening(db, parsed.moves, parsed.headers['FEN']) : null, [pgn, parsed.moves, parsed.headers['FEN']]);
  const positions = useMemo(() => {
    try { return [parsed.headers['FEN'] ?? START_FEN, ...replay(parsed.moves, parsed.headers['FEN']).map((move) => move.fen)]; }
    catch { return [START_FEN]; }
  }, [parsed.moves, parsed.headers['FEN']]);
  const [ply, setPly] = useState(0);
  useEffect(() => setPly(0), [pgn]);
  const validReplay = positions.length === parsed.moves.length + 1;

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
    </div>
  );
}

function About() {
  return <div className="tool-page"><div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> OPEN SOURCE CHESS TOOLS</div><h1>About OPMAS</h1><p>Opening Master là bộ công cụ mã nguồn mở để khám phá, nhận diện và nghiên cứu khai cuộc cờ vua.</p></div></div><section className="about-grid"><article className="panel"><span className="panel-kicker">DATABASE</span><strong>{db.size.toLocaleString('vi-VN')}</strong><h2>Opening lines</h2><p>Thư viện khai cuộc được lập chỉ mục theo ECO, tên và chuỗi nước đi.</p></article><article className="panel"><span className="panel-kicker">OPEN SOURCE</span><strong>MIT</strong><h2>Built in public</h2><p>Đóng góp mã nguồn, báo lỗi hoặc đề xuất tính năng trên GitHub.</p><a className="inline-link" href="https://github.com/VoNguyenPhong-Kids11Ages/OPMAS" target="_blank" rel="noreferrer">Xem repository ↗</a></article><article className="panel"><span className="panel-kicker">INTEGRATIONS</span><strong>2</strong><h2>Chess platforms</h2><p>Hệ sinh thái OPMAS có userscript hỗ trợ Chess.com và Lichess.</p></article></section></div>;
}

export function App() {
  const route = useRoute();
  return (
    <div className="app-shell">
      <header className="topbar"><a className="brand" href="#/explorer"><span className="brand-mark">O</span><span>OPMAS<small>OPENING MASTER</small></span></a><nav className="main-nav" aria-label="Main navigation"><a href="#/explorer" aria-current={route === 'explorer' ? 'page' : undefined}>Explorer</a><a href="#/analyzer" aria-current={route === 'analyzer' ? 'page' : undefined}>PGN Analyzer</a><a href="#/about" aria-current={route === 'about' ? 'page' : undefined}>About</a></nav><div className="header-actions"><a className="download-link" href={`${import.meta.env.BASE_URL}opmas.user.js`} download>Tải userscript ↓</a><a className="github-link" href="https://github.com/VoNguyenPhong-Kids11Ages/OPMAS" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
      <main>{route === 'analyzer' ? <Analyzer /> : route === 'about' ? <About /> : <Explorer />}</main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} OPMAS · Opening Master</span><span>Open source chess intelligence</span></footer>
    </div>
  );
}
