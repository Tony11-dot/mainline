import { useEffect, useState } from 'react';

export const DAY = 86_400_000;

/** The local calendar date as YYYY-MM-DD. */
export function localDay(at: Date | number = new Date()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local midnight at the start of the day containing `at`. */
export function startOfDay(at: number = Date.now()): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The local day, kept current: an app left open overnight (or brought back next morning) moves on with it. */
export function useToday(): string {
  const [day, setDay] = useState(() => localDay());
  useEffect(() => {
    const check = () => setDay(localDay());
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return day;
}
