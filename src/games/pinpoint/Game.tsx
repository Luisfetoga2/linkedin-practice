import { useEffect } from 'react';
import type { GameProps } from '../../core/types';

// Placeholder until the real game lands.
export default function Game({ onReady }: GameProps) {
  useEffect(() => onReady(), [onReady]);
  return <div style={{ padding: 40, textAlign: 'center' }}>Coming soon</div>;
}
