import { defineStrings } from '../../lib/i18n';
import type { Val } from './logic';

const SUN: Val = 1;

/** Structured deduction explanation from the solver; format it with `STR[lang].deduction(msg)`. */
export type DeductionMsg =
  | { key: 'sign'; eq: boolean; value: Val }
  | { key: 'pair' | 'sandwich'; v: Val }
  | { key: 'count'; v: Val; line: number }
  | { key: 'line'; value: Val; line: number; withoutSigns: boolean }
  | { key: 'trial'; tried: Val; value: Val; line: number; inLine: boolean };

export type ViolationMsg = { kind: 'triple' | 'eq' | 'neq' } | { kind: 'count'; line: number };

/** Lines 0..5 are rows, 6..11 columns (see LINES in logic.ts). */
const isRow = (line: number) => line < 6;
const opp = (v: Val): Val => (v === SUN ? 2 : 1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- English ----------

const enName = (v: Val) => (v === SUN ? 'sun' : 'moon');
const enNames = (v: Val) => (v === SUN ? 'suns' : 'moons');
const enLine = (line: number) => (isRow(line) ? 'row' : 'column');

function enDeduction(m: DeductionMsg): string {
  switch (m.key) {
    case 'sign':
      return m.eq
        ? `Cells joined by = must match, so this cell must be a ${enName(m.value)}.`
        : `Cells joined by × must be opposite, so this cell must be a ${enName(m.value)}.`;
    case 'pair':
      return `These two ${enNames(m.v)} are next to each other, so the next cell must be a ${enName(opp(m.v))}.`;
    case 'sandwich':
      return `A ${enName(m.v)} here would make 3 ${enNames(m.v)} in a row, so this cell must be a ${enName(opp(m.v))}.`;
    case 'count':
      return `This ${enLine(m.line)} already has 3 ${enNames(m.v)}, so the rest must be ${enNames(opp(m.v))}.`;
    case 'line':
      return m.withoutSigns
        ? `Look at this ${enLine(m.line)} and its signs: a ${enName(opp(m.value))} here would leave no way to fill it by the rules. So this cell must be a ${enName(m.value)}.`
        : `Look at this ${enLine(m.line)}: a ${enName(opp(m.value))} here would leave no way to fit 3 suns and 3 moons without 3 in a row. So this cell must be a ${enName(m.value)}.`;
    case 'trial':
      return m.inLine
        ? `If this cell were a ${enName(m.tried)}, the forced moves would leave this ${enLine(m.line)} impossible to complete. So it must be a ${enName(m.value)}.`
        : `If this cell were a ${enName(m.tried)}, the forced moves would leave the highlighted ${enLine(m.line)} impossible to complete. So it must be a ${enName(m.value)}.`;
  }
}

function enViolation(v: ViolationMsg): string {
  switch (v.kind) {
    case 'triple':
      return "3 suns or moons can't be next to each other";
    case 'count':
      return `Each ${enLine(v.line)} must have 3 suns and 3 moons`;
    case 'eq':
      return 'Cells joined by = must match';
    case 'neq':
      return 'Cells joined by × must be opposite';
  }
}

// ---------- Spanish ----------

/** "un sol" / "una luna". */
const esOne = (v: Val) => (v === SUN ? 'un sol' : 'una luna');
const esNames = (v: Val) => (v === SUN ? 'soles' : 'lunas');
const esLine = (line: number) => (isRow(line) ? 'fila' : 'columna');

function esDeduction(m: DeductionMsg): string {
  switch (m.key) {
    case 'sign':
      return m.eq
        ? `Las casillas unidas por = deben ser iguales, así que esta casilla debe ser ${esOne(m.value)}.`
        : `Las casillas unidas por × deben ser opuestas, así que esta casilla debe ser ${esOne(m.value)}.`;
    case 'pair':
      return m.v === SUN
        ? `Estos dos soles están juntos, así que la casilla siguiente debe ser una luna.`
        : `Estas dos lunas están juntas, así que la casilla siguiente debe ser un sol.`;
    case 'sandwich':
      return `${cap(esOne(m.v))} aquí formaría 3 ${esNames(m.v)} ${m.v === SUN ? 'seguidos' : 'seguidas'}, así que esta casilla debe ser ${esOne(opp(m.v))}.`;
    case 'count':
      return `Esta ${esLine(m.line)} ya tiene 3 ${esNames(m.v)}, así que las demás casillas deben ser ${esNames(opp(m.v))}.`;
    case 'line':
      return m.withoutSigns
        ? `Mira esta ${esLine(m.line)} y sus signos: con ${esOne(opp(m.value))} aquí no habría forma de completarla según las reglas. Así que esta casilla debe ser ${esOne(m.value)}.`
        : `Mira esta ${esLine(m.line)}: con ${esOne(opp(m.value))} aquí no habría forma de colocar 3 soles y 3 lunas sin que queden 3 seguidos. Así que esta casilla debe ser ${esOne(m.value)}.`;
    case 'trial':
      return m.inLine
        ? `Si esta casilla fuera ${esOne(m.tried)}, las jugadas forzadas harían imposible completar esta ${esLine(m.line)}. Así que debe ser ${esOne(m.value)}.`
        : `Si esta casilla fuera ${esOne(m.tried)}, las jugadas forzadas harían imposible completar la ${esLine(m.line)} resaltada. Así que debe ser ${esOne(m.value)}.`;
  }
}

function esViolation(v: ViolationMsg): string {
  switch (v.kind) {
    case 'triple':
      return 'No puede haber 3 soles o 3 lunas seguidos';
    case 'count':
      return `Cada ${esLine(v.line)} debe tener 3 soles y 3 lunas`;
    case 'eq':
      return 'Las casillas unidas por = deben ser iguales';
    case 'neq':
      return 'Las casillas unidas por × deben ser opuestas';
  }
}

export const STR = defineStrings(
  {
    undo: 'Undo',
    hint: 'Hint',
    clear: 'Clear',
    deduction: enDeduction,
    violation: enViolation,
    wrongSymbol: (v: Val) => `This ${enName(v)} isn't right. Tap it to change it.`,
    reveal: "Here's one to get you going.",
    boardLabel: 'Tango board',
    cellLabel: (row: number, col: number, v: Val, locked: boolean) =>
      `Row ${row}, column ${col}: ${v === SUN ? 'sun' : v ? 'moon' : 'empty'}${locked ? ', locked' : ''}`,
    signEqual: 'equal',
    signOpposite: 'opposite',
  },
  {
    undo: 'Deshacer',
    hint: 'Pista',
    clear: 'Borrar',
    deduction: esDeduction,
    violation: esViolation,
    wrongSymbol: (v: Val) => (v === SUN ? 'Este sol no va aquí. Tócalo para cambiarlo.' : 'Esta luna no va aquí. Tócala para cambiarla.'),
    reveal: 'Aquí tienes una para empezar.',
    boardLabel: 'Tablero de Tango',
    cellLabel: (row: number, col: number, v: Val, locked: boolean) =>
      `Fila ${row}, columna ${col}: ${v === SUN ? 'sol' : v ? 'luna' : 'vacía'}${locked ? ', fija' : ''}`,
    signEqual: 'igual',
    signOpposite: 'opuesto',
  },
);

export type TangoStrings = (typeof STR)['en'];
