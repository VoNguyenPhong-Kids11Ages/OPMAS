import { CHESSNUT_PIECES } from './chessnut-pieces';

const PIECE_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(CHESSNUT_PIECES).map(([piece, svg]) => [
    piece,
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  ]),
);

export interface BoardProps {
  fen: string;
  flip?: boolean;
  /** Squares to highlight, e.g. ['e2', 'e4']. */
  highlight?: string[];
}

export function Board({ fen, flip = false, highlight = [] }: BoardProps) {
  const rows = fen
    .split(' ')[0]!
    .split('/')
    .map((rank) => [...rank].flatMap((char) => (/\\d/.test(char) ? Array<string | null>(Number(char)).fill(null) : [char])));
  const cells = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const rr = flip ? 7 - r : r;
      const ff = flip ? 7 - f : f;
      const piece = rows[rr]?.[ff] ?? null;
      const name = 'abcdefgh'[ff]! + (8 - rr);
      const light = (rr + ff) % 2 === 0;
      const selected = highlight.includes(name);
      cells.push(
        <div
          key={name}
          aria-label={piece ? `${name} ${piece}` : name}
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            minWidth: 0,
            aspectRatio: '1',
            overflow: 'hidden',
            background: selected ? '#e8c75a' : light ? '#e8edf4' : '#71869f',
          }}
        >
          {piece && (
            <img
              src={PIECE_IMAGES[piece] ?? ''}
              alt=""
              draggable={false}
              decoding="async"
              style={{
                display: 'block',
                width: '93%',
                height: '93%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 1px #17243a35)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )}
          {ff === 0 && (
            <span style={{
              position: 'absolute',
              top: 2,
              left: 3,
              color: light ? '#71869f' : '#e8edf4',
              font: '700 9px/1 system-ui',
              opacity: .95,
              pointerEvents: 'none',
            }}>{8 - rr}</span>
          )}
          {rr === 7 && (
            <span style={{
              position: 'absolute',
              right: 3,
              bottom: 2,
              color: light ? '#71869f' : '#e8edf4',
              font: '700 9px/1 system-ui',
              opacity: .95,
              pointerEvents: 'none',
            }}>{'abcdefgh'[ff]}</span>
          )}
        </div>,
      );
    }
  }

  return (
    <div
      role="img"
      aria-label="OPMAS chess board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        aspectRatio: '1',
        containerType: 'inline-size',
        padding: 5,
        border: '1px solid #243248',
        borderRadius: 13,
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #35465e, #1d2a3c)',
        boxShadow: '0 12px 30px rgba(24, 38, 59, .18), inset 0 1px 0 rgba(255,255,255,.16)',
      }}
    >
      {cells}
    </div>
  );
}
