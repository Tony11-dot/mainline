/** Privacy policy, terms, cookie list and accessibility statement are plain pages served by the API (same origin on the web). */
export type LegalPage = '/privacy' | '/terms' | '/cookies' | '/accessibility';

export function legalUrl(path: LegalPage) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return base + path;
}
