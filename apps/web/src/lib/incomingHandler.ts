import { api, sessionToken } from './api';
import { useAuth } from './auth';
import { setPendingImport } from './incoming';
import { platform } from '../platform';
import { toast } from '../ui/toast';

/** Handles deep links and files handed to the app by the OS (all platforms). */
export function handleIncoming(navigate: (to: string) => void) {
  return async (i: { url?: string; text?: string; fileName?: string }) => {
    if (i.text) {
      setPendingImport(i.text);
      navigate('/library');
      return;
    }
    if (!i.url) return;
    let url: URL;
    try {
      url = new URL(i.url);
    } catch {
      return;
    }
    // OAuth return: app.mainline.chess://auth?code=… (mobile) or mainline://auth?code=… (desktop)
    if ((url.protocol === 'app.mainline.chess:' || url.protocol === 'mainline:') && (url.host === 'auth' || url.pathname.replace(/^\/+/, '') === 'auth')) {
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('auth_error');
      if (platform().kind !== 'desktop') void (await import('../platform/capacitor')).closeInAppBrowser();
      if (!code) {
        if (err) toast(err === 'cancelled' ? 'Sign-in cancelled' : `Sign-in failed (${err})`, { kind: 'error' });
        return;
      }
      try {
        const { token } = await api<{ token: string }>('/api/auth/exchange', { method: 'POST', json: { code } });
        sessionToken.set(token);
        await useAuth.getState().refresh();
        const me = useAuth.getState().me;
        toast(me ? `Signed in as ${me.lichessUsername}` : 'Signed in', { kind: 'success' });
      } catch (e) {
        toast((e as Error).message, { kind: 'error' });
      }
      return;
    }
    // In-app links, e.g. from notifications: mainline paths
    if (url.protocol === 'app.mainline.chess:' || url.protocol === 'mainline:') navigate(`/${url.host}${url.pathname}${url.search}`.replace(/\/+$/, '') || '/');
  };
}
