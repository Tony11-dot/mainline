import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { NAV } from '../ui/nav';

interface NativeChromePlugin {
  setTabs(o: { tabs: { id: string; label: string; sfSymbol: string }[]; selected?: string }): Promise<void>;
  select(o: { id: string }): Promise<void>;
  setVisible(o: { visible: boolean }): Promise<void>;
  setTheme(o: { accent: string; dark: boolean }): Promise<void>;
  addListener(event: 'tabSelected', cb: (e: { id: string }) => void): Promise<PluginListenerHandle>;
}

const NativeChrome = registerPlugin<NativeChromePlugin>('NativeChrome');

/** In-app plugins registered with registerPluginInstance() don't appear in isPluginAvailable(); we probe by calling. */
export const hasNativeChrome = () => Capacitor.getPlatform() === 'ios';

/**
 * iOS: the tab bar is native SwiftUI with Liquid Glass (see apps/mobile/ios/App/App/NativeChrome).
 * The web app keeps routing; this keeps the two in sync.
 */
export async function startNativeChrome(router: { navigate: (to: string) => unknown; subscribe: (cb: (s: { location: { pathname: string } }) => void) => unknown; state: { location: { pathname: string } } }) {
  if (!hasNativeChrome()) return;
  const idFor = (path: string) => NAV.slice(1).find((n) => path.startsWith(n.to))?.to ?? '/';
  try {
    await NativeChrome.setTabs({ tabs: NAV.map((n) => ({ id: n.to, label: n.label, sfSymbol: n.sfSymbol })), selected: idFor(router.state.location.pathname) });
  } catch (e) {
    console.warn('NativeChrome unavailable, keeping the web tab bar:', (e as Error).message);
    return; // plugin missing (e.g. an older native shell): keep the web tab bar
  }
  document.documentElement.dataset.nativeChrome = '';
  await NativeChrome.addListener('tabSelected', ({ id }) => void router.navigate(id));
  const sync = (path: string) => {
    void NativeChrome.select({ id: idFor(path) });
    void NativeChrome.setVisible({ visible: !path.startsWith('/train') });
  };
  router.subscribe((s) => sync(s.location.pathname));
  sync(router.state.location.pathname);
  const theme = () => {
    const css = getComputedStyle(document.documentElement);
    void NativeChrome.setTheme({ accent: css.getPropertyValue('--theme-accent-hex').trim() || '#072EB8', dark: document.documentElement.dataset.theme === 'dark' });
  };
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  theme();
}
