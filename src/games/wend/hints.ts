/**
 * Wend hints that act on the board. A hint reveals the next tile of one hidden
 * word W (intended path P) and then makes the lines agree with what's
 * revealed: afterwards exactly one line is P[0..step], in reading order.
 *
 * - The word to hint: if a line already holds the start of some unfound word
 *   (2+ correct tiles in order, drawn either way round), continue the word with
 *   the longest such run ("help me finish what I started"). Otherwise the
 *   shortest unfound word that still has tiles to reveal (as `nextHint`).
 * - The revealed step jumps past tiles the player already has right, so the
 *   hint always adds something.
 * - That line (the "base") becomes P[0..step]: it's extended, flipped when it
 *   was traced backwards, and loses the wrong tiles it continued with. Tiles it
 *   had before the word's start stay as their own line (when 2+ long).
 * - Every other line gives up the tiles the hint needs; what's left of it stays
 *   when it's still a proper line (2+ contiguous tiles).
 */
import { nextHint, type FoundWord, type WendPuzzle } from './generator';
import { assignWords, type Line } from './lines';

export type HintPlan =
  | { kind: 'blocking'; found: FoundWord }
  | {
      kind: 'reveal';
      w: number;
      /** 0-based index of the tile revealed by this hint (P[0..step] is now a line). */
      step: number;
      lines: Line[];
      revealed: number[];
      /** The player's line for this word was drawn backwards and got flipped. */
      flipped: boolean;
      /** Tiles were taken away from lines that were in the way. */
      cleared: boolean;
    }
  | { kind: 'none' };

/**
 * How many tiles of `path`, from its first tile on, line `l` holds in order —
 * reading the line either way round. `reversed` = the match reads backwards.
 */
export function prefixMatch(l: Line, path: number[]): { m: number; reversed: boolean; lead: Line } {
  let best = { m: 0, reversed: false, lead: [] as Line };
  [l, [...l].reverse()].forEach((o, dir) => {
    const i = o.indexOf(path[0]);
    if (i < 0) return;
    let m = 0;
    while (m < path.length && i + m < o.length && o[i + m] === path[m]) m++;
    if (m <= best.m) return;
    // Tiles before the word's start, in the line's own order.
    const lead = o.slice(0, i);
    best = { m, reversed: dir === 1 && l.length > 1, lead: dir === 1 ? lead.reverse() : lead };
  });
  return best;
}

export function planHint(puzzle: WendPuzzle, lines: Line[], revealed: number[]): HintPlan {
  const { words, letters } = puzzle;
  const assign = assignWords(lines, letters, words);
  const found: FoundWord[] = [];
  assign.forEach((w, i) => w >= 0 && found.push({ w, path: lines[i] }));

  const base = nextHint(puzzle, found, revealed);
  if (base.kind === 'blocking') return found[base.found] ? { kind: 'blocking', found: found[base.found] } : { kind: 'none' };

  const used = new Set(found.flatMap((f) => f.path));
  const foundW = new Set(found.map((f) => f.w));
  const cands = words
    .map((hw, w) => ({ hw, w }))
    .filter(({ hw, w }) => !foundW.has(w) && hw.path.every((c) => !used.has(c)))
    .map(({ hw, w }) => {
      // Best line holding the start of this word. A lone selected tile on P[0]
      // counts as a 1-tile start; otherwise a single shared tile is a coincidence.
      let best = { m: 0, reversed: false, lead: [] as Line, li: -1 };
      lines.forEach((l, i) => {
        if (assign[i] >= 0) return;
        const pm = prefixMatch(l, hw.path);
        const ok = pm.m >= 2 || (pm.m === 1 && l.length === 1);
        if (ok && pm.m > best.m) best = { ...pm, li: i };
      });
      return { w, len: hw.word.length, r: revealed[w] ?? 0, ...best };
    });
  if (!cands.length) return { kind: 'none' };

  const byLen = (a: (typeof cands)[number], b: (typeof cands)[number]) => a.len - b.len || a.w - b.w;
  const started = cands.filter((c) => c.m >= 2).sort((a, b) => b.m - a.m || byLen(a, b));
  const fresh = cands.filter((c) => c.r < c.len).sort(byLen);
  const pick = started[0] ?? fresh[0] ?? [...cands].sort(byLen)[0];

  const P = words[pick.w].path;
  const step = Math.min(pick.len - 1, Math.max(pick.r, pick.m));
  const target = P.slice(0, step + 1);
  const inT = new Set(target);

  const out: Line[] = [];
  let cleared = false;
  /** Keep what's left of l once the target's tiles are taken out (pieces of 2+). */
  const trim = (l: Line) => {
    let seg: number[] = [];
    for (const c of l) {
      if (inT.has(c)) {
        if (seg.length > 1) out.push(seg);
        seg = [];
      } else seg.push(c);
    }
    if (seg.length > 1) out.push(seg);
  };
  lines.forEach((l, i) => {
    if (i === pick.li) {
      // The base line turns into the target; its wrong continuation is dropped.
      if (l.some((c) => !inT.has(c))) cleared = true;
      trim(pick.lead);
      return;
    }
    if (!l.some((c) => inT.has(c))) {
      // Stray single-tile selections don't survive a board change.
      if (l.length > 1) out.push(l);
      return;
    }
    if (l.length > 1) cleared = true;
    trim(l);
  });
  out.push(target);

  const nextRevealed = revealed.slice();
  nextRevealed[pick.w] = Math.max(pick.r, step + 1);
  return {
    kind: 'reveal',
    w: pick.w,
    step,
    lines: out,
    revealed: nextRevealed,
    flipped: pick.li >= 0 && pick.reversed,
    cleared,
  };
}
