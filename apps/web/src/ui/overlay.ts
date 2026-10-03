import { useEffect } from 'react';
import { create } from 'zustand';

/** How many modal surfaces (sheets, full-screen moments) are open; the iOS native tab bar hides while any are. */
export const useOverlays = create<{ open: number }>(() => ({ open: 0 }));

/** Counts this component as an open overlay while `active`. */
export function useOverlay(active = true) {
  useEffect(() => {
    if (!active) return;
    useOverlays.setState((s) => ({ open: s.open + 1 }));
    return () => useOverlays.setState((s) => ({ open: s.open - 1 }));
  }, [active]);
}
