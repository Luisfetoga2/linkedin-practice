import { STR, type QueensStrings } from './i18n';
import type { Puzzle } from './puzzle';
import type { Solver, Technique } from './solver';

/** Board cell values. */
export const EMPTY = 0;
export const CROSS = 1;
export const QUEEN = 2;

export interface Hint {
  kind: 'wrong-queen' | 'wrong-cross' | 'step' | 'reveal';
  technique?: Technique;
  message: string;
  /** Cells the hint is about (outlined). */
  targets: number[];
  /** Cells that explain it (kept bright while the rest is dimmed). */
  focus: number[];
  /** What "Apply" would do to the targets. */
  action: 'cross' | 'queen' | 'clear';
}

/**
 * LinkedIn-style hint: first point out a mistake (a queen off the unique solution, or an ✕ covering a solution
 * cell), otherwise explain the next logical deduction. Falls back to revealing a queen. `t` picks the language.
 */
export function getHint(puzzle: Puzzle, solver: Solver, board: ArrayLike<number>, t: QueensStrings = STR.en): Hint | null {
  const n = puzzle.size;
  const isSolution = (i: number) => puzzle.solution[Math.floor(i / n)] === i % n;

  for (let i = 0; i < n * n; i++) {
    if (board[i] === QUEEN && !isSolution(i)) {
      return { kind: 'wrong-queen', message: t.wrongQueen, targets: [i], focus: [i], action: 'clear' };
    }
  }
  for (let i = 0; i < n * n; i++) {
    if (board[i] === CROSS && isSolution(i)) {
      return { kind: 'wrong-cross', message: t.wrongCross, targets: [i], focus: [i], action: 'clear' };
    }
  }

  const state = solver.stateFromBoard(board);
  if (solver.isSolved(state)) return null;
  const step = solver.findStep(state);
  if (step) {
    return {
      kind: 'step',
      technique: step.technique,
      message: t.step(step.msg),
      targets: step.targets,
      focus: step.focus,
      action: step.kind === 'place' ? 'queen' : 'cross',
    };
  }

  // Solver is stuck: reveal the first missing queen.
  for (let r = 0; r < n; r++) {
    const cell = r * n + puzzle.solution[r];
    if (board[cell] !== QUEEN) {
      return { kind: 'reveal', message: t.reveal, targets: [cell], focus: [cell], action: 'queen' };
    }
  }
  return null;
}
