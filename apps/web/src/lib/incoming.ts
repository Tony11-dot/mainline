/**
 * PGNs arriving from outside (PWA share target, "Open with…" on iOS/Android/desktop, drag & drop).
 * Stashed here, then the library opens its import sheet with the text.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingImport(text: string) {
  pending = text;
  listeners.forEach((l) => l());
}

export function takePendingImport(): string | null {
  const t = pending;
  pending = null;
  return t;
}

export function onPendingImport(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** PWA share target: the service worker stored the shared text in the 'share' cache. */
export async function readSharedFromServiceWorker(): Promise<string | null> {
  try {
    const cache = await caches.open('share');
    const res = await cache.match('/shared-pgn');
    if (!res) return null;
    await cache.delete('/shared-pgn');
    return await res.text();
  } catch {
    return null;
  }
}
