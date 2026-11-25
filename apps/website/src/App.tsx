import { useEffect, useMemo, useState } from 'react';
import openings from '../../../data/openings/openings.json';
import { OpeningDatabase, type Opening } from '@opmas/opening-database';
import { detectOpening } from '@opmas/opening-detector';
import { parsePgn } from '@opmas/pgn-parser';

const db = new OpeningDatabase(openings as Opening[]);
const NAV = [
  ['install', 'Cài đặt'],
  ['usage', 'Hướng dẫn'],
  ['help', 'Trợ giúp'],
  ['tools', 'Công cụ'],
  ['contributing', 'Đóng góp'],
] as const;

function useRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '') || 'home';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Detector() {
  const [pgn, setPgn] = useState('');
  const [q, setQ] = useState('');
  const found = useMemo(() => (pgn.trim() ? detectOpening(db, parsePgn(pgn).moves) : null), [pgn]);
  return (
    <>
      <h2>Nhận diện khai cuộc</h2>
      {db.size === 0 && <p>Cơ sở dữ liệu đang trống. Chạy <code>pnpm fetch:sources &amp;&amp; pnpm build:db</code>.</p>}
      <textarea rows={5} placeholder="Dán PGN vào đây" value={pgn} onChange={(e) => setPgn(e.target.value)} />
      {found && (
        <div className="card">
          <b>{found.opening.eco} {found.opening.name}</b>
          <div>{found.opening.pgn}</div>
        </div>
      )}
      <h2>Thư viện ({db.size})</h2>
      <input placeholder="Tìm khai cuộc..." value={q} onChange={(e) => setQ(e.target.value)} />
      {db.search(q, 30).map((o) => (
        <div key={o.eco + o.pgn}>{o.eco} {o.name}</div>
      ))}
    </>
  );
}

export function App() {
  const route = useRoute();
  return (
    <>
      <nav>
        <a href="#/">OPMAS</a>
        {NAV.map(([id, label]) => (
          <a key={id} href={`#/${id}`} aria-current={route === id ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
      <main>
        {route === 'home' && (
          <>
            <h1>OPMAS</h1>
            <p>Userscript thư viện khai cuộc và nhận diện khai cuộc từ PGN cho Chess.com và Lichess.</p>
            <a className="btn" href="/opmas.user.js" download>Tải userscript</a>{' '}
            <a className="btn" href="/analyze-prototype.html">Phân tích ván đã kết thúc</a>
          </>
        )}
        {route === 'install' && <p>Cài Tampermonkey hoặc Violentmonkey, rồi mở file <code>opmas.user.js</code>.</p>}
        {route === 'usage' && <p>Mở nút OPMAS ở góc màn hình, dán PGN hoặc tìm trong thư viện. Panel bị khóa khi ván đang chơi.</p>}
        {route === 'help' && <p>Xem docs/ trong repository để biết cách xử lý sự cố.</p>}
        {route === 'tools' && <Detector />}
        {route === 'contributing' && <p>Xem CONTRIBUTING.md trong repository.</p>}
      </main>
    </>
  );
}
