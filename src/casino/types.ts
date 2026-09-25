import type { ComponentType, ReactNode } from 'react';
import type { Lang, Localized } from '../lib/i18n';

export type CasinoId = 'blackjack' | 'gems' | 'road';

export interface CasinoMeta {
  id: CasinoId;
  name: Localized<string>;
  tagline: Localized<string>;
  color: string;
  colorEnd: string;
  tint: string;
  howToPlay: Localized<ReactNode>;
  Icon: ComponentType<{ size?: number }>;
}

/**
 * A live round. The stake is recorded as lost the moment the round starts, so leaving or reloading
 * mid-round forfeits it like walking away from a table; `settle` then records what came back.
 */
export interface Round {
  /** Put more money on this round (Blackjack double / split). */
  raise(extra: number): void;
  /**
   * Finish the round. `payout` is everything returned to the player, stake included:
   * 0 = lost, stake = push, 2 × stake = even-money win.
   */
  settle(payout: number, note?: string): void;
}

export interface CasinoGameProps {
  lang: Lang;
  /** The amount in the bet box (always a valid, positive number of dollars). */
  bet: number;
  setBet(v: number): void;
  /** Start a round with this stake. */
  begin(stake: number, note?: string): Round;
  /** True while a round is live: locks the bet box and asks before leaving. */
  onBusy(busy: boolean): void;
}

export interface CasinoEntry {
  meta: CasinoMeta;
  load: () => Promise<{ default: ComponentType<CasinoGameProps> }>;
}
