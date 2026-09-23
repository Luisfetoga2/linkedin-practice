import { defineStrings } from '../../lib/i18n';
import { REGION_NAMES } from './puzzle';
import type { UnitType } from './solver';

/**
 * Structured hint explanation produced by the solver; formatted into text with `STR[lang].step(msg)`.
 * `a`/`b` are the unit groups the deduction talks about (see Solver.groupStep).
 */
export type StepMsg =
  | { key: 'single'; unit: UnitType; index: number }
  | { key: 'regionToLines' | 'linesToRegions' | 'linesToLines'; a: UnitType; aIdx: number[]; b: UnitType; bIdx: number[] }
  | { key: 'block'; unit: UnitType; index: number; count: number }
  | { key: 'chain'; unit: UnitType; index: number; forced: number };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

// ---------- English ----------

const enRegion = (i: number) => REGION_NAMES[i] ?? `#${i + 1}`;

function enUnits(type: UnitType, idx: number[]): string {
  if (idx.length === 1) {
    if (type === 'region') return `the ${enRegion(idx[0])} region`;
    return `${type === 'row' ? 'row' : 'column'} ${idx[0] + 1}`;
  }
  if (type === 'region') return `the ${joinList(idx.map(enRegion), 'and')} regions`;
  return `${type === 'row' ? 'rows' : 'columns'} ${joinList(idx.map((i) => String(i + 1)), 'and')}`;
}

function enStep(m: StepMsg): string {
  switch (m.key) {
    case 'single':
      return `Only one cell is left for a queen in ${enUnits(m.unit, [m.index])}.`;
    case 'regionToLines': {
      const A = enUnits(m.a, m.aIdx);
      const B = enUnits(m.b, m.bIdx);
      return m.aIdx.length === 1
        ? `${cap(A)} only has open cells in ${B}, so its queen must be there. No other region can use ${B}.`
        : `${cap(A)} only have open cells in ${B}, so their queens fill those lines. No other region can use them.`;
    }
    case 'linesToRegions': {
      const A = enUnits(m.a, m.aIdx);
      const B = enUnits(m.b, m.bIdx);
      return m.aIdx.length === 1
        ? `Every open cell in ${A} belongs to ${B}, so that region's queen must be in ${A}. Cross out the rest of ${B}.`
        : `${cap(A)} only have open cells in ${B}, so those regions' queens must sit in these lines. Cross out the rest of those regions.`;
    }
    case 'linesToLines':
      return `${cap(enUnits(m.a, m.aIdx))} only have open cells in ${enUnits(m.b, m.bIdx)}, so their queens use up those ${m.b === 'col' ? 'columns' : 'rows'}. No other ${m.a === 'row' ? 'row' : 'column'} can use them.`;
    case 'block': {
      const name = enUnits(m.unit, [m.index]);
      return m.count === 1
        ? `Placing a queen on the highlighted cell would leave no room for ${name}, so it gets an ✕.`
        : `A queen on any of the highlighted cells would leave no room for ${name}, so they all get an ✕.`;
    }
    case 'chain': {
      const name = enUnits(m.unit, [m.index]);
      return m.forced === 0
        ? `Placing a queen on the highlighted cell would leave no room for ${name}, so it gets an ✕.`
        : `If a queen went on the highlighted cell, it would force ${m.forced === 1 ? 'another queen' : 'other queens'} and then ${name} would have no room left. So it gets an ✕.`;
    }
  }
}

// ---------- Spanish ----------

/** Color adjectives in feminine form, agreeing with "región". Same order as REGION_NAMES. */
const ES_REGION_NAMES = ['morada', 'naranja', 'azul', 'verde', 'gris', 'roja', 'amarilla', 'beige', 'rosa', 'turquesa'];
const esRegion = (i: number) => ES_REGION_NAMES[i] ?? `n.º ${i + 1}`;

function esUnits(type: UnitType, idx: number[]): string {
  if (idx.length === 1) {
    if (type === 'region') return `la región ${esRegion(idx[0])}`;
    return `la ${type === 'row' ? 'fila' : 'columna'} ${idx[0] + 1}`;
  }
  if (type === 'region') return `las regiones ${joinList(idx.map(esRegion), 'y')}`;
  return `las ${type === 'row' ? 'filas' : 'columnas'} ${joinList(idx.map((i) => String(i + 1)), 'y')}`;
}

function esStep(m: StepMsg): string {
  switch (m.key) {
    case 'single':
      return `Solo queda una casilla libre para la reina de ${esUnits(m.unit, [m.index])}.`;
    case 'regionToLines': {
      const A = esUnits(m.a, m.aIdx);
      const B = esUnits(m.b, m.bIdx);
      return m.aIdx.length === 1
        ? `${cap(A)} solo tiene casillas libres en ${B}, así que su reina tiene que ir ahí. Ninguna otra región puede usar ${B}.`
        : `${cap(A)} solo tienen casillas libres en ${B}, así que sus reinas ocupan esas líneas. Ninguna otra región puede usarlas.`;
    }
    case 'linesToRegions': {
      const A = esUnits(m.a, m.aIdx);
      const B = esUnits(m.b, m.bIdx);
      return m.aIdx.length === 1
        ? `Todas las casillas libres de ${A} están en ${B}, así que la reina de esa región tiene que ir en ${A}. Marca con ✕ el resto de ${B}.`
        : `${cap(A)} solo tienen casillas libres en ${B}, así que las reinas de esas regiones tienen que ir en estas líneas. Marca con ✕ el resto de esas regiones.`;
    }
    case 'linesToLines':
      return `${cap(esUnits(m.a, m.aIdx))} solo tienen casillas libres en ${esUnits(m.b, m.bIdx)}, así que sus reinas ocupan esas ${m.b === 'col' ? 'columnas' : 'filas'}. Ninguna otra ${m.a === 'row' ? 'fila' : 'columna'} puede usarlas.`;
    case 'block': {
      const name = esUnits(m.unit, [m.index]);
      return m.count === 1
        ? `Una reina en la casilla resaltada no dejaría espacio para ${name}, así que lleva una ✕.`
        : `Una reina en cualquiera de las casillas resaltadas no dejaría espacio para ${name}, así que todas llevan una ✕.`;
    }
    case 'chain': {
      const name = esUnits(m.unit, [m.index]);
      return m.forced === 0
        ? `Una reina en la casilla resaltada no dejaría espacio para ${name}, así que lleva una ✕.`
        : `Si pusieras una reina en la casilla resaltada, obligaría a colocar ${m.forced === 1 ? 'otra reina' : 'otras reinas'} y luego ${name} se quedaría sin espacio. Por eso lleva una ✕.`;
    }
  }
}

export const STR = defineStrings(
  {
    undo: 'Undo',
    hint: 'Hint',
    clear: 'Clear',
    applyCross: 'Place ✕',
    applyQueen: 'Place queen',
    applyClear: 'Remove it',
    wrongQueen: 'This queen is in the wrong place.',
    wrongCross: 'A queen belongs where you placed an ✕.',
    reveal: 'Here is where a queen goes.',
    step: enStep,
    boardLabel: (n: number) => `Queens ${n} by ${n} board`,
    cellLabel: (row: number, col: number, region: number, value: 'empty' | 'cross' | 'queen') =>
      `Row ${row}, column ${col}, ${enRegion(region)}${value === 'queen' ? ', queen' : value === 'cross' ? ', crossed out' : ''}`,
  },
  {
    undo: 'Deshacer',
    hint: 'Pista',
    clear: 'Borrar',
    applyCross: 'Poner ✕',
    applyQueen: 'Poner reina',
    applyClear: 'Quitarla',
    wrongQueen: 'Esta reina no va aquí.',
    wrongCross: 'Pusiste una ✕ donde va una reina.',
    reveal: 'Aquí va una reina.',
    step: esStep,
    boardLabel: (n: number) => `Tablero de Queens de ${n} por ${n}`,
    cellLabel: (row: number, col: number, region: number, value: 'empty' | 'cross' | 'queen') =>
      `Fila ${row}, columna ${col}, región ${esRegion(region)}${value === 'queen' ? ', reina' : value === 'cross' ? ', marcada con ✕' : ''}`,
  },
);

export type QueensStrings = (typeof STR)['en'];
