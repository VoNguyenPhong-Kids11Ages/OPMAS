export type LiveSite = 'lichess' | 'chesscom';

export interface LiveMoves {
  site: LiveSite;
  moves: string[];
  source: string;
  updatedAt: number;
}

const SAN = /^(?:O-O(?:-O)?[+#]?|0-0(?:-0)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/;

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
    if (SAN.test(token)) moves.push(token.replace(/^0-0-0([+#]?)$/, 'O-O-O$1').replace(/^0-0([+#]?)$/, 'O-O$1'));
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
    '[data-ply]',
    '[data-san]',
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
    '[data-san]',
  ],
};

export type LiveSearchRoot = Document | ShadowRoot;

/** Query open shadow roots as well as the page DOM (web-component move lists use shadow DOM). */
export function getLiveSearchRoots(doc: Document): LiveSearchRoot[] {
  const roots: LiveSearchRoot[] = [doc];
  const visited = new Set<ShadowRoot>();
  for (let index = 0; index < roots.length; index++) {
    const root = roots[index]!;
    for (const host of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const shadow = host.shadowRoot;
      if (shadow && !visited.has(shadow)) {
        visited.add(shadow);
        roots.push(shadow);
      }
    }
  }
  return roots;
}

function visibleText(node: HTMLElement): string {
  return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Lichess embeds the current game's move history in its bootstrap JSON.
 * Treat it as a fallback: the visible move list wins whenever it is at least
 * as complete, because page-init-data may be a snapshot from page load.
 */
function readLichessBootstrapMoves(doc: Document): string[] {
  const script = doc.querySelector<HTMLScriptElement>('#page-init-data');
  if (!script?.textContent) return [];
  try {
    const payload: unknown = JSON.parse(script.textContent);
    if (!payload || typeof payload !== 'object') return [];
    const data = (payload as { data?: { game?: { turns?: number; steps?: Array<{ ply?: number; san?: string | null }> } } }).data;
    const game = data?.game;
    if (!game || !Array.isArray(game.steps)) return [];
    const moves = game.steps
      .filter((step): step is { ply: number; san: string } =>
        Number.isInteger(step.ply) && step.ply > 0 && typeof step.san === 'string' && step.san.length > 0)
      .sort((a, b) => a.ply - b.ply)
      .map((step) => step.san);
    // A partially serialized bootstrap payload must not replace a good DOM read.
    if (typeof game.turns === 'number' && moves.length > game.turns) return [];
    return moves;
  } catch {
    return [];
  }
}

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
  const roots = getLiveSearchRoots(doc);

  for (const selector of SELECTORS[site]) {
    // Keep candidates root-local: a host's composed text can duplicate the same
    // moves exposed by its shadow-root children.
    for (const root of roots) {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!nodes.length) continue;

      // Prefer leaf nodes when a selector also matches a wrapper and its children.
      const leafNodes = nodes.filter((node) => !nodes.some((other) => other !== node && node.contains(other)));
      const sample = leafNodes.length ? leafNodes : nodes;
      const joined = sample.map(visibleText).filter(Boolean).join(' ');
      const moves = parseSanTokens(joined);
      const signature = moves.join(' ');
      if (!signature || seen.has(signature)) continue;
      seen.add(signature);
      if (moves.length > best.moves.length) best = { moves, source: selector };
    }
  }

  // Keep fallback selectors narrow: broad game containers can include chat or annotations.
  if (best.moves.length < 2) {
    const fallbackSelectors = ['[aria-label*="move" i]', '[aria-label*="notation" i]'];
    for (const selector of fallbackSelectors) {
      for (const root of roots) {
        const node = root.querySelector<HTMLElement>(selector);
        if (!node) continue;
        const moves = parseSanTokens(visibleText(node));
        if (moves.length > best.moves.length) best = { moves, source: selector };
      }
    }
  }

  if (site === 'lichess') {
    const bootstrapMoves = readLichessBootstrapMoves(doc);
    if (bootstrapMoves.length > best.moves.length) {
      best = { moves: bootstrapMoves, source: '#page-init-data data.game.steps[].san' };
    }
  }

  return { site, moves: best.moves, source: best.source, updatedAt: Date.now() };
}
