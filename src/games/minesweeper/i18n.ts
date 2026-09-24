import { defineStrings, plural } from '../../lib/i18n';

export const STR = defineStrings(
  {
    hint: 'Hint',
    tapMode: 'Tap mode',
    dig: 'Open',
    flag: 'Flag',
    minesLeft: (n: number) => `${n} ${plural(n, 'mine', 'mines')} left`,
    gridLabel: (w: number, h: number, mines: number) => `Minesweeper, ${w} by ${h}, ${mines} mines`,
    cellLabel: (r: number, c: number, state: string) => `Row ${r}, column ${c}: ${state}`,
    hiddenSq: 'hidden',
    flagged: 'flagged',
    mineSq: 'mine',
    blank: 'empty',
    start: 'Tap any square to start. The first tap is always safe and opens an area.',
    wrongFlag: 'There’s no mine under this flag, so it was removed.',
    singleSafe: (n: number) => `This ${n} already has ${n} flagged ${plural(n, 'mine', 'mines')} around it, so its other neighbors are safe.`,
    singleMine: (n: number, need: number) =>
      need === n
        ? `This ${n} has exactly ${n} hidden ${plural(n, 'neighbor', 'neighbors')}, so ${n === 1 ? 'it’s a mine' : 'they’re all mines'}.`
        : `This ${n} still needs ${need} ${plural(need, 'mine', 'mines')} and has exactly ${need} hidden ${plural(need, 'neighbor', 'neighbors')} left, so ${need === 1 ? 'it’s a mine' : 'they’re all mines'}.`,
    pairMine: (a: number, o: number, needA: number, needO: number, k: number) =>
      `The ${o} still needs ${needO} ${plural(needO, 'mine', 'mines')}. At most ${needA} can fit in the squares it shares with the ${a}, so its other ${k === 1 ? 'square is a mine' : `${k} squares are all mines`}.`,
    pairSafe: (a: number, o: number, needA: number, needO: number, k: number) =>
      k === 0
        ? `Every hidden square around the ${o} also touches the ${a}, and both still need ${needA} ${plural(needA, 'mine', 'mines')}. So the ${a}’s other squares are safe.`
        : `The ${o} still needs ${needO} ${plural(needO, 'mine', 'mines')} but has only ${k} ${plural(k, 'square', 'squares')} away from the ${a}. So the ${a}’s ${needA === 1 ? 'mine is' : 'mines are'} in the squares they share, and its other squares are safe.`,
    countSafe: (m: number) => `All ${m} mines are flagged, so every hidden square left is safe.`,
    countMine: (left: number) => `${left} ${plural(left, 'mine is', 'mines are')} left and exactly ${left} hidden ${plural(left, 'square', 'squares')}, so ${left === 1 ? 'it’s a mine' : 'they’re all mines'}.`,
    enumSafe: 'Try every way the mines could fit around the highlighted numbers: this square is safe in all of them.',
    enumMine: 'Try every way the mines could fit around the highlighted numbers: this square is a mine in all of them.',
    reveal: 'This square is safe.',
    boom: 'You opened a mine.',
    cleared: 'Field cleared!',
  },
  {
    hint: 'Pista',
    tapMode: 'Modo de toque',
    dig: 'Abrir',
    flag: 'Bandera',
    minesLeft: (n: number) => `${plural(n, 'Queda', 'Quedan')} ${n} ${plural(n, 'mina', 'minas')}`,
    gridLabel: (w: number, h: number, mines: number) => `Buscaminas de ${w} por ${h}, ${mines} minas`,
    cellLabel: (r: number, c: number, state: string) => `Fila ${r}, columna ${c}: ${state}`,
    hiddenSq: 'oculta',
    flagged: 'con bandera',
    mineSq: 'mina',
    blank: 'vacía',
    start: 'Toca cualquier casilla para empezar. El primer toque siempre es seguro y abre una zona.',
    wrongFlag: 'No hay ninguna mina bajo esta bandera, así que la quitamos.',
    singleSafe: (n: number) =>
      `Este ${n} ya tiene ${n} ${plural(n, 'mina marcada', 'minas marcadas')} alrededor, así que sus demás vecinas son seguras.`,
    singleMine: (n: number, need: number) =>
      need === n
        ? `Este ${n} tiene exactamente ${n} ${plural(n, 'vecina oculta', 'vecinas ocultas')}, así que ${n === 1 ? 'es una mina' : 'todas son minas'}.`
        : `A este ${n} todavía le ${plural(need, 'falta', 'faltan')} ${need} ${plural(need, 'mina', 'minas')} y le ${plural(need, 'queda', 'quedan')} exactamente ${need} ${plural(need, 'vecina oculta', 'vecinas ocultas')}, así que ${need === 1 ? 'es una mina' : 'todas son minas'}.`,
    pairMine: (a: number, o: number, needA: number, needO: number, k: number) =>
      `Al ${o} todavía le ${plural(needO, 'falta', 'faltan')} ${needO} ${plural(needO, 'mina', 'minas')}. Como mucho ${needA} ${plural(needA, 'cabe', 'caben')} en las casillas que comparte con el ${a}, así que ${k === 1 ? 'su otra casilla es una mina' : `sus otras ${k} casillas son minas`}.`,
    pairSafe: (a: number, o: number, needA: number, needO: number, k: number) =>
      k === 0
        ? `Todas las casillas ocultas alrededor del ${o} también tocan al ${a}, y a los dos les ${plural(needA, 'falta', 'faltan')} ${needA} ${plural(needA, 'mina', 'minas')}. Así que las demás casillas del ${a} son seguras.`
        : `Al ${o} todavía le ${plural(needO, 'falta', 'faltan')} ${needO} ${plural(needO, 'mina', 'minas')}, pero solo tiene ${k} ${plural(k, 'casilla', 'casillas')} lejos del ${a}. Así que ${needA === 1 ? 'la mina' : 'las minas'} del ${a} ${needA === 1 ? 'está' : 'están'} en las casillas que comparten, y sus demás casillas son seguras.`,
    countSafe: (m: number) => `Las ${m} minas ya están marcadas, así que todas las casillas ocultas que quedan son seguras.`,
    countMine: (left: number) =>
      `${plural(left, 'Queda', 'Quedan')} ${left} ${plural(left, 'mina', 'minas')} y exactamente ${left} ${plural(left, 'casilla oculta', 'casillas ocultas')}, así que ${left === 1 ? 'es una mina' : 'todas son minas'}.`,
    enumSafe: 'Prueba todas las formas en que las minas caben alrededor de los números resaltados: esta casilla es segura en todas.',
    enumMine: 'Prueba todas las formas en que las minas caben alrededor de los números resaltados: esta casilla es una mina en todas.',
    reveal: 'Esta casilla es segura.',
    boom: 'Abriste una mina.',
    cleared: '¡Campo despejado!',
  },
);

export type Strings = (typeof STR)['en'];
