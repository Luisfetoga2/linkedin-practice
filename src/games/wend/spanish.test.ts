import { describe, expect, it } from 'vitest';
import {
  countTilings,
  EN_LEXICON,
  generatePuzzle,
  isAdjacent,
  keyToTileLetter,
  lexiconIfLoaded,
  loadLexicon,
  makeLexicon,
  SIZE_CONFIG,
  toTileLetters,
} from './generator';
import { STR } from './i18n';
import * as esWords from './words.es';

const ES = makeLexicon(esWords);
const SIZES = [5, 6];

describe('wend spanish generator', () => {
  it('is deterministic for a fixed seed and differs from English', () => {
    for (const size of SIZES) {
      const a = generatePuzzle(12345, size, ES);
      expect(generatePuzzle(12345, size, ES)).toEqual(a);
      expect(generatePuzzle(12346, size, ES).letters.join('')).not.toEqual(a.letters.join(''));
      expect(generatePuzzle(12345, size, EN_LEXICON).letters.join('')).not.toEqual(a.letters.join(''));
    }
  });

  for (const size of SIZES) {
    it(`produces valid, uniquely tileable ${size}x${size} Spanish puzzles quickly`, () => {
      const cfg = SIZE_CONFIG[size];
      const times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const t0 = performance.now();
        const p = generatePuzzle(seed * 101, size, ES);
        times.push(performance.now() - t0);

        expect(p.walls.filter(Boolean).length).toBe(cfg.walls);
        expect(p.words.map((w) => w.word.length)).toEqual(cfg.lengths);
        const cover = new Array(size * size).fill(0);
        for (const { word, path } of p.words) {
          expect(word).toMatch(/^[A-ZÑ]+$/);
          expect(ES.hiddenWords(word.length)).toContain(word.toLowerCase());
          expect(ES.isValidWord(word)).toBe(true);
          path.forEach((c, i) => {
            cover[c]++;
            expect(p.letters[c]).toBe(word[i]);
            if (i > 0) expect(isAdjacent(size, path[i - 1], c)).toBe(true);
          });
        }
        p.walls.forEach((isWall, i) => expect(cover[i]).toBe(isWall ? 0 : 1));
        expect(new Set(p.words.map((w) => w.word)).size).toBe(p.words.length);
        expect(countTilings(size, p.letters, p.words.map((w) => w.word), 2)).toBe(1);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const max = times[times.length - 1];
      console.log(`es size ${size}: median ${median.toFixed(1)}ms, max ${max.toFixed(1)}ms`);
      expect(median).toBeLessThan(150);
      expect(max).toBeLessThan(1000);
    });
  }

  it('puts Ñ on the board as its own tile letter', () => {
    let withEnye = 0;
    for (let seed = 1; seed <= 200 && !withEnye; seed++) {
      const p = generatePuzzle(seed, 5, ES);
      if (p.letters.includes('Ñ')) {
        withEnye++;
        expect(countTilings(5, p.letters, p.words.map((w) => w.word), 2)).toBe(1);
      }
    }
    expect(withEnye).toBeGreaterThan(0);
  });
});

describe('wend spanish word lists', () => {
  it('has plenty of normalized words per length', () => {
    const all = new Set<string>();
    for (let L = 3; L <= 9; L++) {
      const ws = ES.hiddenWords(L);
      expect(ws.length).toBeGreaterThan(L === 3 ? 80 : 400);
      for (const w of ws) {
        expect(w).toMatch(/^[a-zñ]+$/);
        expect(w.length).toBe(L);
        expect(all.has(w)).toBe(false);
        all.add(w);
      }
    }
    expect(esWords.VALID_WORDS.split(' ').length).toBeGreaterThan(20000);
    expect(esWords.VALID_WORDS).toMatch(/^[a-zñ ]+$/);
  });

  it('knows plurals and conjugations, without accents', () => {
    for (const w of ['casas', 'NIÑOS', 'comiamos', 'hablé', 'Canción', 'pingüino', 'estás']) {
      expect(ES.isValidWord(toTileLetters(w))).toBe(true);
    }
    expect(ES.isValidWord('XQZT')).toBe(false);
    // The English lexicon is untouched.
    expect(EN_LEXICON.isValidWord('things')).toBe(true);
    expect(EN_LEXICON.isValidWord('casas')).toBe(false);
  });

  it('loads the Spanish lexicon lazily and caches it', async () => {
    const lex = await loadLexicon('es');
    expect(lexiconIfLoaded('es')).toBe(lex);
    expect(await loadLexicon('es')).toBe(lex);
    expect(lexiconIfLoaded('en')).toBe(EN_LEXICON);
    expect(generatePuzzle(99, 5, lex)).toEqual(generatePuzzle(99, 5, ES));
  });
});

describe('wend letter normalization', () => {
  it('maps text to the tile alphabet', () => {
    expect(toTileLetters('Canción')).toBe('CANCION');
    expect(toTileLetters('pingüino')).toBe('PINGUINO');
    expect(toTileLetters('niño')).toBe('NIÑO');
    expect(toTileLetters('NIÑO')).toBe('NIÑO');
    expect(toTileLetters('ñ')).toBe('Ñ');
  });

  it('maps key presses to tile letters', () => {
    expect(keyToTileLetter('a')).toBe('A');
    expect(keyToTileLetter('Z')).toBe('Z');
    expect(keyToTileLetter('á')).toBe('A');
    expect(keyToTileLetter('É')).toBe('E');
    expect(keyToTileLetter('ü')).toBe('U');
    expect(keyToTileLetter('ñ')).toBe('Ñ');
    expect(keyToTileLetter('Ñ')).toBe('Ñ');
    for (const k of ['Shift', 'Dead', '1', ' ', 'ß', 'Enter']) expect(keyToTileLetter(k)).toBeNull();
  });
});

describe('wend strings', () => {
  it('has the same keys in English and Spanish', () => {
    expect(Object.keys(STR.es).sort()).toEqual(Object.keys(STR.en).sort());
    for (const k of Object.keys(STR.en) as (keyof typeof STR.en)[]) expect(typeof STR.es[k]).toBe(typeof STR.en[k]);
  });
});
