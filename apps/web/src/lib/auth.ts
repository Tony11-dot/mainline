import { create } from 'zustand';
import { accountName, type Me } from '@mainline/shared';
import { api, apiUrl, sessionToken } from './api';
import { platform } from '../platform';
import { toast } from '../ui/toast';
import { t } from './i18n';

interface AuthState {
  me: Me | null;
  loaded: boolean;
  /** Sign-in options the server offers (Chess.com needs its OAuth credentials configured). */
  providers: { lichess: boolean; chesscom: boolean };
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Deletes the server account (if signed in), then every byte stored on this device. */
  deleteEverything: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loaded: false,
  providers: { lichess: true, chesscom: false },
  refresh: async () => {
    void api<{ lichess: boolean; chesscom: boolean }>('/api/auth/providers')
      .then((providers) => set({ providers }))
      .catch(() => undefined);
    try {
      const { me } = await api<{ me: Me | null }>('/api/me');
      set({ me, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    sessionToken.set(null);
    set({ me: null });
  },
  deleteEverything: async () => {
    if (useAuth.getState().me) await api('/api/me', { method: 'DELETE' });
    sessionToken.set(null);
    set({ me: null });
    await eraseDevice();
  },
}));

/** Local data: IndexedDB, preferences, caches and the service worker. The caller reloads. */
async function eraseDevice() {
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager?.getSubscription();
    if (sub) {
      await api('/api/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } catch {
    /* no push */
  }
  try {
    (await import('./idb').then((m) => m.db())).close();
  } catch {
    /* not opened */
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('mainline');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  if ('caches' in self) for (const k of await caches.keys()) await caches.delete(k);
  for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
}

/** Full-page redirect on the web (COOP forbids popups); system browser on native (Phase 5). */
export function startLichessLogin(returnPath = location.pathname + location.search) {
  void startLogin('lichess', returnPath);
}

/**
 * Starts OAuth with a provider. Signed in already? Chess.com is linked to this account instead: the
 * web sends its session cookie; apps (bearer token) fetch a one-use link ticket first.
 */
export async function startLogin(provider: 'lichess' | 'chesscom', returnPath = location.pathname + location.search) {
  const p = platform();
  const params = new URLSearchParams({ return: returnPath });
  if (p.kind === 'desktop') params.set('native', 'desktop');
  else if (p.isNative) params.set('native', '1');
  if (provider === 'chesscom' && p.isNative && useAuth.getState().me) {
    try {
      params.set('link', (await api<{ ticket: string }>('/api/auth/link-ticket', { method: 'POST' })).ticket);
    } catch {
      /* sign in as the Chess.com account instead */
    }
  }
  const url = apiUrl(`/api/auth/${provider}/start?${params}`);
  if (!p.isNative) {
    location.href = url;
    return;
  }
  const abs = url.startsWith('http') ? url : `${location.origin}${url}`;
  // iOS: Apple's sign-in sheet hands the callback straight back (full size on iPad, no "Open in" prompt).
  const native = await import('../platform/nativeAuth');
  if (native.hasNativeAuth()) {
    try {
      await finishOAuthReturn(new URL(await native.nativeWebAuth(abs, 'app.mainline.chess')));
      return;
    } catch (e) {
      if (native.isCancelled(e)) return;
      /* sheet unavailable: fall back to the in-app browser + deep link */
    }
  }
  void p.openExternal(abs);
}

/** Apps: the OAuth callback (app.mainline.chess://auth?code=… or ?auth_error=…) → bearer session. */
export async function finishOAuthReturn(url: URL) {
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('auth_error');
  if (!code) {
    if (err && err !== 'cancelled') toast(authErrorText(err), { kind: 'error' });
    return;
  }
  try {
    const { token } = await api<{ token: string }>('/api/auth/exchange', { method: 'POST', json: { code } });
    await signedIn(token);
  } catch (e) {
    toast((e as Error).message, { kind: 'error' });
  }
}

async function signedIn(token: string) {
  sessionToken.set(token);
  await useAuth.getState().refresh();
  const me = useAuth.getState().me;
  toast(me ? t('Signed in as {name}', { name: t(accountName(me)) }) : t('Signed in'), { kind: 'success' });
}

/** iOS: Sign in with Apple. The API verifies Apple's identity token (and our nonce inside it). */
export async function signInWithApple() {
  const native = await import('../platform/nativeAuth');
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const { identityToken, name, authorizationCode } = await native.nativeAppleSignIn(hashed);
    const { token } = await api<{ token: string }>('/api/auth/apple', {
      method: 'POST',
      json: { identityToken, nonce: raw, name: name || undefined, authorizationCode: authorizationCode || undefined },
    });
    await signedIn(token);
  } catch (e) {
    if (!native.isCancelled(e)) toast(t('Sign in with Apple failed: {error}', { error: (e as Error).message }), { kind: 'error' });
  }
}

/** Human wording for ?auth_error= codes from the OAuth callbacks. */
export function authErrorText(code: string): string {
  switch (code) {
    case 'cancelled':
      return t('Sign-in cancelled');
    case 'already_linked':
      return t('That Chess.com account is already linked to another MainLine account');
    case 'expired':
      return t('Sign-in took too long — try again');
    default:
      return t('Sign-in failed ({code})', { code });
  }
}
