import { replay } from '@opmas/chess-core';
import type { Opening, OpeningDatabase } from '@opmas/opening-database';

export interface Detection {
  opening: Opening;
  /** Ply (half-move count) at which the opening was last matched. */
  ply: number;
  /** True when the whole input line is the opening itself. */
  exact: boolean;
}

/**
 * Position-based detection: walks the game and returns the deepest position found in the
 * database. Transpositions are recognised, and a game that merely shares a first few moves
 * with an opening is not labelled with that opening.
 */
export function detectOpening(
  db: OpeningDatabase,
  sans: string[],
  startFen?: string,
): Detection | null {
  let plies;
  try {
    plies = replay(sans, startFen);
  } catch {
    return null;
  }
  let best: Detection | null = null;
  for (let i = 0; i < plies.length; i++) {
    const opening = db.lookup(plies[i]!.key);
    if (opening) best = { opening, ply: i + 1, exact: i === plies.length - 1 };
  }
  return best;
}
