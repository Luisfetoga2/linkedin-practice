import { Backspace } from '../../core/components/Icons';
import type { STR } from './i18n';
import styles from './Game.module.css';

/** QWERTY rows per word language. The Spanish layout adds Ñ after L. */
const ROWS: Record<'en' | 'es', string[]> = {
  en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  es: ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'],
};

interface Props {
  labels: Pick<(typeof STR)['en'], 'keyboard' | 'enterKey' | 'enterAria' | 'backspace'>;
  /** Word language; picks the layout (default English). */
  layout?: 'en' | 'es';
  disabled?: boolean;
  onKey(key: string): void;
}

/** On-screen QWERTY keyboard (LinkedIn word-game style). Keys never take focus. */
export function Keyboard({ labels, layout = 'en', disabled, onKey }: Props) {
  const press = (k: string) => () => {
    if (!disabled) onKey(k);
  };
  const noFocus = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className={`${styles.keyboard}${disabled ? ` ${styles.kbDisabled}` : ''}`} aria-label={labels.keyboard}>
      {ROWS[layout].map((row, r) => (
        <div key={r} className={styles.kbRow}>
          {r === 2 && (
            <button type="button" className={`${styles.key} ${styles.keyWide}`} onPointerDown={noFocus} onClick={press('Enter')} aria-label={labels.enterAria}>
              {labels.enterKey}
            </button>
          )}
          {row.split('').map((ch) => (
            <button key={ch} type="button" className={styles.key} onPointerDown={noFocus} onClick={press(ch)} aria-label={ch}>
              {ch}
            </button>
          ))}
          {r === 2 && (
            <button type="button" className={`${styles.key} ${styles.keyWide}`} onPointerDown={noFocus} onClick={press('Backspace')} aria-label={labels.backspace}>
              <Backspace size={22} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
