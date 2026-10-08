import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { NAV } from '../ui/nav';
import { useLaunch } from '../launch/LaunchScreen';
import { useOverlays } from '../ui/overlay';
import { useAssistant } from '../lib/assistant';
import { t, useI18n } from '../lib/i18n';

interface NativeChromePlugin {
  setTabs(o: { tabs: { id: string; label: string; sfSymbol: string }[]; action?: { id: string; label: string; sfSymbol: string }; selected?: string }): Promise<void>;
  select(o: { id: string }): Promise<void>;
  setVisible(o: { visible: boolean }): Promise<void>;
  setTheme(o: { accent: string; dark: boolean }): Promise<void>;
  addListener(event: 'tabSelected' | 'actionTapped', cb: (e: { id: string }) => void): Promise<PluginListenerHandle>;
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
  // Sub-screens light up their parent tab.
  const ALIAS: [string, string][] = [['/setup', '/explore'], ['/rep/', '/library']];
  const idFor = (path: string) => ALIAS.find(([p]) => path.startsWith(p))?.[1] ?? NAV.slice(1).find((n) => path.startsWith(n.to))?.to ?? '/';
  // Ask AI rides beside the bar as its own glass circle instead of floating over the page.
  const tabsFor = (path: string) => ({
    tabs: NAV.map((n) => ({ id: n.to, label: t(n.label), sfSymbol: n.sfSymbol })),
    action: { id: 'assistant', label: t('Ask AI'), sfSymbol: 'sparkles' },
    selected: idFor(path),
  });
  try {
    // Just the animation while it plays: hide the bar before it's first installed.
    if (useLaunch.getState().active) await NativeChrome.setVisible({ visible: false });
    await NativeChrome.setTabs(tabsFor(router.state.location.pathname));
  } catch (e) {
    console.warn('NativeChrome unavailable, keeping the web tab bar:', (e as Error).message);
    return; // plugin missing (e.g. an older native shell): keep the web tab bar
  }
  document.documentElement.dataset.nativeChrome = '';
  // Tab titles follow the app language.
  useI18n.subscribe((s, p) => {
    if (s.lang !== p.lang) void NativeChrome.setTabs(tabsFor(router.state.location.pathname));
  });
  await NativeChrome.addListener('tabSelected', ({ id }) => void router.navigate(id));
  await NativeChrome.addListener('actionTapped', () => useAssistant.getState().setOpen(true));
  // iPad (and wide split view): the web sidebar is the navigation, so the bottom bar stays hidden.
  const wide = matchMedia('(min-width: 768px)');
  const sync = (path: string) => {
    void NativeChrome.select({ id: idFor(path) });
    void NativeChrome.setVisible({ visible: !wide.matches && !useLaunch.getState().active && useOverlays.getState().open === 0 && !path.startsWith('/train') });
  };
  router.subscribe((s) => sync(s.location.pathname));
  useLaunch.subscribe(() => sync(router.state.location.pathname));
  // Sheets put their footer buttons where the bar floats: get out of the way while one is open.
  useOverlays.subscribe((s, p) => {
    if ((s.open > 0) !== (p.open > 0)) sync(router.state.location.pathname);
  });
  wide.addEventListener('change', () => sync(router.state.location.pathname));
  sync(router.state.location.pathname);
  const theme = () => {
    const css = getComputedStyle(document.documentElement);
    void NativeChrome.setTheme({ accent: css.getPropertyValue('--theme-accent-hex').trim() || '#072EB8', dark: document.documentElement.dataset.theme === 'dark' });
  };
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  theme();
}
