import { describe, expect, it } from 'vitest';
import { PICTURES } from '.';

describe('Spanish picture names', () => {
  for (const [n, list] of Object.entries(PICTURES)) {
    it(`${n}x${n}: every picture has a unique Spanish name with its article`, () => {
      for (const p of list) {
        expect(p.es, `${p.name} has no Spanish name`).toBeTruthy();
        expect(p.es, `${p.name}: "${p.es}" should start with un/una/unos/unas`).toMatch(/^(un|una|unos|unas) \S/);
        expect(p.es).toBe(p.es.trim());
      }
      const names = list.map((p) => p.es);
      expect(new Set(names).size).toBe(names.length);
    });
  }
});
