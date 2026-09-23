import { useEffect } from 'react';
import type { GameProps } from '../../core/types';

// Placeholder until the real game lands.
export default function Game({ onReady }: GameProps) {
  useEffect(() => onReady(), [onReady]);
  return <div className="lp-loading">Coming soon</div>;
}
