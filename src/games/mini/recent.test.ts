import { describe, expect, it } from 'vitest';
import { freshClues, remember, RECENT_MAX } from './recent';
import { generateMini } from './generator';
import { ENTRIES } from './data/en';

describe('clue rotation', () => {
  const p = generateMini(7, 5, ENTRIES);
  const all = [...p.across, ...p.down];

  it('leaves clues alone when nothing was seen', () => {
    expect(freshClues(p, ENTRIES, [])).toBe(p);
  });

  it('swaps a recently seen clue for an unseen one of the same word, keeping the grid', () => {
    const recent = remember(p, []);
    const q = freshClues(p, ENTRIES, recent);
    expect(q.solution).toEqual(p.solution);
    const bank = new Map(ENTRIES.map((e) => [e.word, e.clues]));
    [...q.across, ...q.down].forEach((c, i) => {
      expect(c.answer).toBe(all[i].answer);
      expect(bank.get(c.answer)).toContain(c.clue);
      if (bank.get(c.answer)!.length > 1) expect(c.clue).not.toBe(all[i].clue);
    });
  });

  it('keeps the recent list capped and most recent last', () => {
    let recent: string[] = [];
    for (let s = 1; s <= 80; s++) recent = remember(generateMini(s, 5, ENTRIES), recent);
    expect(recent.length).toBeLessThanOrEqual(RECENT_MAX);
    const last = generateMini(80, 5, ENTRIES);
    expect(recent.slice(-1)[0].startsWith(last.down[last.down.length - 1].answer)).toBe(true);
  });
});
