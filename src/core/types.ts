import type { ComponentType, ReactNode } from 'react';
import type { Lang, Localized } from '../lib/i18n';

export type GameId = 'queens' | 'tango' | 'zip' | 'sudoku' | 'patches' | 'wend' | 'crossclimb' | 'pinpoint' | 'wordle' | 'nonogram' | 'mini';

/** A selectable puzzle variant shown on the intro screen (size, difficulty, word length...). */
export interface GameOption {
  id: string;
  label: Localized<string>;
  choices: { value: string; label: Localized<string> }[];
  default: string;
  /**
   * The default tracks the interface language (e.g. Wordle's word list) and isn't remembered
   * between rounds; picking a value on the intro still overrides it for that session.
   */
  followsLanguage?: boolean;
}

/** Boolean toggle rendered in the game's settings sheet; read it with useGameSetting(). */
export interface GameSettingDef {
  key: string;
  label: Localized<string>;
  description?: Localized<string>;
  default: boolean;
}

export interface GameMeta {
  id: GameId;
  name: Localized<string>;
  tagline: Localized<string>;
  /** Brand color: intro background, accents. */
  color: string;
  /** Second stop of the intro gradient. */
  colorEnd: string;
  /** Pastel tile behind the icon on the home list. */
  tint: string;
  /** 'time' = ranked by solve time. 'guesses' = can be lost, ranked by guesses used. */
  scoring: 'time' | 'guesses';
  maxGuesses?: number;
  /** False for games without hints (Pinpoint): hides hint badges in results. Defaults to true. */
  hasHints?: boolean;
  howToPlay: Localized<ReactNode>;
  /**
   * Languages the puzzle content exists in. Omit for language-neutral games. When the interface
   * language isn't listed, the shell shows an "English only for now" note.
   */
  contentLanguages?: Lang[];
  options?: GameOption[];
  settings?: GameSettingDef[];
  Icon: ComponentType<{ size?: number }>;
}

export interface GameResult {
  won: boolean;
  /** Guess-scored games: number of guesses used. */
  guesses?: number;
  /** Plain-text share snippet (emoji grid etc.), appended below the headline in "Share". */
  share?: string;
  /** Extra content shown in the results sheet, e.g. "The answer was CRANE". */
  summary?: ReactNode;
}

export interface GameProps {
  seed: number;
  /** Interface language; the game is remounted when it changes. */
  lang: Lang;
  /** Selected option values keyed by GameOption.id (always filled with defaults). */
  options: Record<string, string>;
  /** Shell has paused the clock; the board is covered and input should be ignored. */
  paused: boolean;
  /** Call once when the puzzle is generated and interactive. Starts the clock. */
  onReady(): void;
  /** Call every time the player consumes a hint. */
  onHint(): void;
  /** Call exactly once when the round ends (solved, or lost for guess games). */
  onComplete(result: GameResult): void;
}

export interface GameEntry {
  meta: GameMeta;
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}

/**
 * Stats bucket for a round. Language-following options at their default ('en') are left out, so
 * rounds recorded before the option existed stay in the same bucket as new English rounds.
 */
export function statsVariant(meta: GameMeta, options: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(options)) {
    const opt = meta.options?.find((o) => o.id === k);
    if (opt?.followsLanguage && v === opt.default) continue;
    out[k] = v;
  }
  return out;
}
