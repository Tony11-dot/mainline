import { finishOAuthReturn } from './auth';
import { setPendingImport } from './incoming';
import { platform } from '../platform';

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
      if (platform().kind !== 'desktop') void (await import('../platform/capacitor')).closeInAppBrowser();
      await finishOAuthReturn(url);
      return;
    }
    // In-app links, e.g. from notifications: mainline paths
    if (url.protocol === 'app.mainline.chess:' || url.protocol === 'mainline:') navigate(`/${url.host}${url.pathname}${url.search}`.replace(/\/+$/, '') || '/');
  };
}
