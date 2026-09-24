import { platform } from '../platform';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
  get notConfigured() {
    return this.status === 503 && this.code === 'not_configured';
  }
  get offline() {
    return this.status === 0;
  }
}

const TOKEN_KEY = 'mainline.session';
export const sessionToken = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function apiUrl(path: string): string {
  return `${platform().apiBase}${path}`;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) };
  const token = sessionToken.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, body, headers, credentials: 'include' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'offline', "You're offline — showing what's saved on this device.");
  }
  if (!res.ok) {
    let data: { error?: string; message?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    const ra = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? `Request failed (${res.status})`, ra);
  }
  return (await res.json()) as T;
}
