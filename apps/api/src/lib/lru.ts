/** Tiny TTL LRU cache used when Postgres isn't configured (and as a hot layer in front of it). */
export class Lru<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(
    private max: number,
    private ttlMs: number,
  ) {}
  get(k: string): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    this.map.delete(k);
    this.map.set(k, e);
    return e.v;
  }
  set(k: string, v: V, ttlMs = this.ttlMs) {
    this.map.delete(k);
    this.map.set(k, { v, exp: Date.now() + ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  delete(k: string) {
    this.map.delete(k);
  }
}
