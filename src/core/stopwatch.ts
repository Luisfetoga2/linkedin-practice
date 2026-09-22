/** Accumulating stopwatch that survives pauses; read `.ms` any time. */
export class Stopwatch {
  private acc = 0;
  private since: number | null = null;

  get running(): boolean {
    return this.since !== null;
  }

  get ms(): number {
    return this.acc + (this.since === null ? 0 : performance.now() - this.since);
  }

  start(): void {
    if (this.since === null) this.since = performance.now();
  }

  stop(): void {
    if (this.since !== null) {
      this.acc += performance.now() - this.since;
      this.since = null;
    }
  }

  reset(): void {
    this.acc = 0;
    this.since = null;
  }
}
