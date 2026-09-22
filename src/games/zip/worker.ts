import { generateZip } from './generator';

// Generates large boards off the main thread.
self.onmessage = (e: MessageEvent<{ size: number; seed: number }>) => {
  const puzzle = generateZip(e.data.size, e.data.seed);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(puzzle);
};
