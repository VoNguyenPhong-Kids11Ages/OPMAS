const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

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
    .map((r) => [...r].flatMap((c) => (/\d/.test(c) ? Array<string | null>(+c).fill(null) : [c])));
  const cells = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const rr = flip ? 7 - r : r;
      const ff = flip ? 7 - f : f;
      const piece = rows[rr]?.[ff] ?? null;
      const name = 'abcdefgh'[ff]! + (8 - rr);
      cells.push(
        <div
          key={name}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9cqw',
            background: highlight.includes(name) ? '#d9b84a' : (rr + ff) % 2 ? '#6f8f72' : '#e8e4d4',
            color: piece && piece === piece.toUpperCase() ? '#fff' : '#15181f',
            textShadow: piece && piece === piece.toUpperCase() ? '0 0 2px #000' : 'none',
          }}
        >
          {piece ? `${GLYPH[piece.toLowerCase()]}\uFE0E` : ''}
        </div>,
      );
    }
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        aspectRatio: '1',
        containerType: 'inline-size',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {cells}
    </div>
  );
}
