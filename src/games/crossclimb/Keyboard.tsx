import { Backspace } from '../../core/components/Icons';
import styles from './Game.module.css';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  disabled?: boolean;
  onKey(key: string): void;
}

/** On-screen QWERTY keyboard (LinkedIn word-game style). Keys never take focus. */
export function Keyboard({ disabled, onKey }: Props) {
  const press = (k: string) => () => {
    if (!disabled) onKey(k);
  };
  const noFocus = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className={`${styles.keyboard}${disabled ? ` ${styles.kbDisabled}` : ''}`} aria-label="Keyboard">
      {ROWS.map((row, r) => (
        <div key={r} className={styles.kbRow}>
          {r === 2 && (
            <button type="button" className={`${styles.key} ${styles.keyWide}`} onPointerDown={noFocus} onClick={press('Enter')} aria-label="Enter">
              Enter
            </button>
          )}
          {row.split('').map((ch) => (
            <button key={ch} type="button" className={styles.key} onPointerDown={noFocus} onClick={press(ch)} aria-label={ch}>
              {ch}
            </button>
          ))}
          {r === 2 && (
            <button type="button" className={`${styles.key} ${styles.keyWide}`} onPointerDown={noFocus} onClick={press('Backspace')} aria-label="Backspace">
              <Backspace size={22} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
