import wordplay from './data/near/wordplay';
import things from './data/near/things';
import knowledge from './data/near/knowledge';
import culture from './data/near/culture';

/** Category name → related concepts (closest first), used only for the end-of-round closeness recap. */
export const NEAR: ReadonlyMap<string, readonly string[]> = new Map(
  [wordplay, things, knowledge, culture].flatMap((src) =>
    src
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('|'))
      .map((l): [string, string[]] => {
        const [name, terms = ''] = l.split('|');
        return [
          name.trim(),
          terms
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ];
      }),
  ),
);

export function nearFor(name: string): readonly string[] {
  return NEAR.get(name) ?? [];
}
