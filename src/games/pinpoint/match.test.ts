import { describe, expect, it } from 'vitest';
import { CATEGORIES, type Category } from './data';
import { editDistance, isMatch, isMeaningful, stem, tokenize } from './match';

function cat(name: string): Category {
  const c = CATEGORIES.find((x) => x.name === name);
  if (!c) throw new Error(`missing category ${name}`);
  return c;
}

const cases: [string, string[], string[]][] = [
  [
    'Things with keys',
    ['keys', 'Key', 'things with keys', 'stuff that has a key', 'Things that have keys', 'objects with keys', 'KEYS!', 'kyes', 'things with a key'],
    ['locks', 'lock', 'keyboard', 'piano', 'doors', 'things', 'musical instruments', 'monkeys'],
  ],
  [
    '___ ball',
    ['ball', '___ball', 'words before ball', 'Words that go before "ball"', 'balls', 'compound words ending in ball'],
    ['sports', 'basket', 'ballet', 'snowman'],
  ],
  [
    'Things you can shuffle',
    ['shuffle', 'things you shuffle', 'Things that are shuffled', 'shuffling', 'stuff that gets shuffled', 'shufle'],
    ['cards', 'deck', 'music', 'mix'],
  ],
  ['Famous Jacksons', ['Jackson', 'jacksons', 'famous jacksons', 'people named Jackson', 'Jakson'], ['Michael', 'singers', 'jack']],
  ['Planets', ['planets', 'Planet', 'the planets', 'solar system', 'plantes', 'planits'], ['plane', 'planes', 'gods', 'stars']],
  ['Chess pieces', ['chess', 'chess pieces', 'Chess piece', 'pieces in chess', 'chessmen'], ['pieces', 'board games', 'checkers']],
  ['Pizza toppings', ['pizza toppings', 'pizza', 'toppings', 'things on pizza', 'pizza topping'], ['food', 'pasta', 'cheese']],
  ['Card games', ['card games', 'cards', 'types of card games', 'card game'], ['games', 'board games', 'poker']],
  ['Units of time', ['units of time', 'time', 'time units', 'measures of time', 'units of tiem'], ['units', 'clock', 'calendar']],
  ['Flightless birds', ['flightless birds', "birds that can't fly", 'flightless', "birds that cannot fly", "can't fly"], ['birds', 'animals', 'fly']],
  ['Things with shells', ['shells', 'things with a shell', 'has a shell', 'shelled things'], ['sea creatures', 'shellfish', 'eggs']],
  ['Things you can break', ['break', 'things you can break', 'broken things', 'breakable'], ['snap', 'things']],
  ['Hidden animals', ['hidden animals', 'animals', 'words containing animals', 'animals hidden in words', 'contains an animal'], ['hidden', 'words']],
  ['Palindromes', ['palindromes', 'palindrome', 'palindromic', 'words that are the same backwards', 'same forwards and backwards'], ['reverse', 'words']],
  ['Things that are black and white', ['black and white', 'black & white things', 'black-and-white', 'black white'], ['black', 'white', 'animals']],
  ['Things made from potatoes', ['potatoes', 'things made from potatoes', 'potato', 'potato products'], ['vegetables', 'food']],
  ['Lord of the Rings characters', ['Lord of the Rings', 'LOTR', 'lord of the rings characters', 'Tolkien'], ['rings', 'lords', 'hobbies']],
  ['Star Wars characters', ['star wars', 'Star Wars characters', 'star war', 'jedi'], ['stars', 'wars', 'movies']],
  ['Things with teeth', ['teeth', 'things with teeth', 'things that have teeth', 'toothed things'], ['animals', 'dentist']],
  ['Things you can raise', ['raise', 'things you can raise', 'raised things', 'things you raise'], ['lift', 'rise']],
  ['Things that are sticky', ['sticky', 'sticky things', 'sticky stuff'], ['glue', 'sweet']],
  ['Sound like letters', ['letters', 'sound like letters', 'homophones of letters', 'letter sounds'], ['sounds', 'words']],
  ['Homophones of animals', ['homophones of animals', 'animal homophones', 'sound like animals'], ['animal sounds', 'animals', 'sounds']],
  ['Animal sounds', ['animal sounds', 'sounds animals make', 'noises', 'animal noises'], ['animals', 'homophones']],
  ['Things with needles', ['needles', 'things with needles', 'needle'], ['pointy', 'sharp things']],
  ["Children's games", ["children's games", 'kids games', 'childrens games', 'playground games'], ['games', 'sports']],
  ['James Bond films', ['Bond films', 'james bond', '007', 'bond movies'], ['movies', 'films', 'spies']],
  ['Seven dwarfs', ['seven dwarfs', 'dwarfs', 'the seven dwarves', 'snow white dwarfs'], ['seven', 'emotions']],
];

describe('pinpoint answer matching', () => {
  for (const [name, yes, no] of cases) {
    const c = cat(name);
    for (const g of yes) it(`"${g}" matches ${name}`, () => expect(isMatch(g, c)).toBe(true));
    for (const g of no) it(`"${g}" does not match ${name}`, () => expect(isMatch(g, c)).toBe(false));
  }

  it('rejects spray guesses that list many categories', () => {
    expect(isMatch('keys planets colors animals food music', cat('Things with keys'))).toBe(false);
  });

  it('empty or filler-only guesses are not meaningful', () => {
    expect(isMeaningful('')).toBe(false);
    expect(isMeaningful('things that are')).toBe(false);
    expect(isMeaningful('the types of stuff')).toBe(false);
    expect(isMeaningful('keys')).toBe(true);
  });

  it('stems variants together', () => {
    expect(stem('shuffled')).toBe(stem('shuffle'));
    expect(stem('shuffling')).toBe(stem('shuffle'));
    expect(stem('horses')).toBe(stem('horse'));
    expect(stem('boxes')).toBe(stem('box'));
    expect(stem('berries')).toBe(stem('berry'));
    expect(stem('cookies')).toBe(stem('cookie'));
    expect(stem('knives')).toBe(stem('knife'));
    expect(stem('popped')).toBe(stem('pop'));
    expect(stem('glasses')).toBe(stem('glass'));
    expect(stem('cactus')).toBe('cactus');
    expect(stem('string')).toBe('string');
  });

  it('tokenizes with accents and punctuation removed', () => {
    expect(tokenize('Crème Brûlée!')).toEqual(['crem', 'brule']);
    expect(tokenize("Santa's reindeer")).toEqual(['santa', 'reindeer']);
  });

  it('edit distance counts transpositions as one', () => {
    expect(editDistance('keys', 'kyes')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('abcdef', 'x', 2)).toBe(3);
  });
});
