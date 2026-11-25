export interface MoveListProps {
  sans: string[];
  ply: number;
  onSelect: (ply: number) => void;
}

export function MoveList({ sans, ply, onSelect }: MoveListProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {sans.map((san, i) => (
        <button
          key={i}
          onClick={() => onSelect(i + 1)}
          aria-current={ply === i + 1}
          style={{ fontWeight: ply === i + 1 ? 700 : 400 }}
        >
          {i % 2 === 0 ? `${i / 2 + 1}. ` : ''}
          {san}
        </button>
      ))}
    </div>
  );
}
