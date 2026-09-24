import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Board beside the panels: wide *and* landscape. Portrait tablets stack instead, so the board stays large. */
export const SPLIT_LAYOUT = '(min-width: 1024px) and (min-aspect-ratio: 6/5)';
