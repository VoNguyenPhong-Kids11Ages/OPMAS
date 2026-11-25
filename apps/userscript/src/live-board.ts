export type LiveSite = 'lichess' | 'chesscom';

export interface LiveMoves {
  site: LiveSite;
  moves: string[];
  source: string;
  updatedAt: number;
}

const SAN = /^(?:O-O(?:-O)?|0-0(?:-0)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?)$/;

/** Convert move-list text into SAN tokens. This deliberately ignores clocks, move numbers and comments. */
export function parseSanTokens(text: string): string[] {
  const tokens = text
    .replace(/\u00a0/g, ' ')
    .replace(/\b\d+\.(?:\.\.)?/g, ' ')
    .replace(/\{[^}]*\}|\([^)]*\)/g, ' ')
    .split(/\s+/);
  const moves: string[] = [];
  for (let token of tokens) {
    token = token.trim().replace(/^\d+\.{1,3}/, '').replace(/[!?]+$/g, '');
    token = token.replace(/^[,;]+|[,;]+$/g, '');
    if (SAN.test(token)) moves.push(token.replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O'));
  }
  return moves;
}

const SELECTORS: Record<LiveSite, string[]> = {
  lichess: [
    '.round__app .moves .move',
    '.round__app .moves',
    '.analyse__moves .move',
    '.analyse__moves',
    '.moves .move',
    '.move-list .move',
    'l4x .move',
  ],
  chesscom: [
    'wc-simple-move-list',
    'wc-move-list',
    'wc-move-list-move',
    '.move-list-component',
    '.move-list-row',
    '.move-text-component',
    '.node',
    '.move-list .move',
    '[data-ply]',
  ],
};

/**
 * Read only the visible move list from a supported chess site. No board clicks,
 * move submission, engine access, network requests or opponent-control behavior.
 */
export function readLiveMoves(doc: Document, href: string): LiveMoves | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const host = url.hostname.replace(/^www\./, '');
  const site: LiveSite | null = host === 'lichess.org'
    ? 'lichess'
    : host === 'chess.com'
      ? 'chesscom'
      : null;
  if (!site) return null;

  let best: { moves: string[]; source: string } = { moves: [], source: '' };
  const seen = new Set<string>();
  for (const selector of SELECTORS[site]) {
    const nodes = [...doc.querySelectorAll<HTMLElement>(selector)];
    if (!nodes.length) continue;

    // Prefer leaf nodes when a selector also matches a wrapper and its children.
    const leafNodes = nodes.filter((node) => !nodes.some((other) => other !== node && node.contains(other)));
    const sample = leafNodes.length ? leafNodes : nodes;
    const joined = sample.map((node) => node.innerText || node.textContent || '').join(' ');
    const moves = parseSanTokens(joined);
    const signature = moves.join(' ');
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    if (moves.length > best.moves.length) best = { moves, source: selector };
  }

  // Some clients render the move list as a single accessible text region.
  if (best.moves.length < 2) {
    const fallbackSelectors = site === 'lichess'
      ? ['.round__app', '[aria-label*="move" i]']
      : ['wc-simple-move-list', '.game-layout', '[aria-label*="move" i]'];
    for (const selector of fallbackSelectors) {
      const node = doc.querySelector<HTMLElement>(selector);
      if (!node) continue;
      const moves = parseSanTokens(node.innerText || node.textContent || '');
      if (moves.length > best.moves.length) best = { moves, source: selector };
    }
  }

  return { site, moves: best.moves, source: best.source, updatedAt: Date.now() };
}
