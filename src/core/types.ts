import type { ComponentType, ReactNode } from 'react';

export type GameId = 'queens' | 'tango' | 'zip' | 'sudoku' | 'patches' | 'wend' | 'crossclimb' | 'pinpoint' | 'wordle' | 'nonogram';

/** A selectable puzzle variant shown on the intro screen (size, difficulty, word length...). */
export interface GameOption {
  id: string;
  label: string;
  choices: { value: string; label: string }[];
  default: string;
}

/** Boolean toggle rendered in the game's settings sheet; read it with useGameSetting(). */
export interface GameSettingDef {
  key: string;
  label: string;
  description?: string;
  default: boolean;
}

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
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
  howToPlay: ReactNode;
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
