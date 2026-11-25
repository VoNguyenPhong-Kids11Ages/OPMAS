export interface Opening {
  eco: string;
  name: string;
  pgn: string;
  /** Canonical SAN moves. */
  moves: string[];
  /** Position key after the last move (see @opmas/chess-core positionKey). */
  key: string;
  ply: number;
}

export class OpeningDatabase {
  private readonly openings: Opening[];
  private readonly byKey = new Map<string, Opening[]>();

  constructor(openings: Opening[]) {
    this.openings = openings;
    for (const o of openings) {
      const list = this.byKey.get(o.key);
      if (list) list.push(o);
      else this.byKey.set(o.key, [o]);
    }
  }

  get size(): number {
    return this.openings.length;
  }

  all(): readonly Opening[] {
    return this.openings;
  }

  /** Opening reached exactly in this position (any move order). */
  lookup(key: string): Opening | undefined {
    return this.byKey.get(key)?.[0];
  }

  search(query: string, limit = 50): Opening[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.openings.slice(0, limit);
    return this.openings
      .filter((o) => `${o.eco} ${o.name} ${o.pgn}`.toLowerCase().includes(q))
      .slice(0, limit);
  }

  byEco(prefix: string): Opening[] {
    const p = prefix.toUpperCase();
    return this.openings.filter((o) => o.eco.startsWith(p));
  }
}
