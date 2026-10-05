import { createBrowserRouter, RouterProvider } from 'react-router';
import { useI18n } from './lib/i18n';
import { AppShell } from './ui/AppShell';
import { LaunchScreen, shouldShowLaunch, useLaunch } from './launch/LaunchScreen';
import { platform } from './platform';
import { handleIncoming } from './lib/incomingHandler';
import { HomeScreen } from './screens/HomeScreen';

// Screens load on demand: the first paint only needs the shell and Today.
const lazy = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'library', lazy: lazy(() => import('./screens/LibraryScreen'), 'LibraryScreen') },
      { path: 'library/ready', lazy: lazy(() => import('./screens/ReadyScreen'), 'ReadyScreen') },
      { path: 'library/openings', lazy: lazy(() => import('./screens/OpeningsScreen'), 'OpeningsScreen') },
      { path: 'rep/:id', lazy: lazy(() => import('./screens/RepertoireScreen'), 'RepertoireScreen') },
      { path: 'train', lazy: lazy(() => import('./screens/TrainScreen'), 'TrainScreen') },
      { path: 'explore', lazy: lazy(() => import('./screens/ExploreScreen'), 'ExploreScreen') },
      { path: 'stats', lazy: lazy(() => import('./screens/StatsScreen'), 'StatsScreen') },
      { path: 'setup', lazy: lazy(() => import('./screens/SetupScreen'), 'SetupScreen') },
      { path: 'games', lazy: lazy(() => import('./screens/GamesScreen'), 'GamesScreen') },
      { path: 'welcome', lazy: lazy(() => import('./screens/WelcomeScreen'), 'WelcomeScreen') },
      { path: 'settings', lazy: lazy(() => import('./screens/SettingsScreen'), 'SettingsScreen') },
    ],
  },
]);

/** OS integrations that need the router. Called by main.tsx after initPlatform() (never at import time). */
export function startPlatformHooks() {
  // Web OAuth returns land on ?auth_error=… when sign-in didn't complete.
  const authError = new URLSearchParams(location.search).get('auth_error');
  if (authError) {
    void import('./lib/auth').then(({ authErrorText }) => void import('./ui/toast').then(({ toast }) => toast(authErrorText(authError), { kind: 'error' })));
    const u = new URL(location.href);
    u.searchParams.delete('auth_error');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }
  useLaunch.setState({ active: shouldShowLaunch(platform().isNative) });
  // Deep links, OAuth returns, files and notification taps from the OS.
  platform().onIncoming((i) => void handleIncoming((to) => void router.navigate(to))(i));
  if (platform().kind === 'ios' || platform().kind === 'android') {
    void import('./platform/capacitor').then((m) => m.bindNotificationTaps((to) => void router.navigate(to)));
  }
  if (platform().kind === 'ios') void import('./platform/nativeChrome').then((m) => m.startNativeChrome(router));
}

export function App() {
  const launching = useLaunch((s) => s.active);
  // Changing language remounts the screens so every string re-renders in the new language.
  const lang = useI18n((s) => s.lang);
  return (
    <>
      <RouterProvider key={lang} router={router} />
      {launching && <LaunchScreen onDone={() => useLaunch.setState({ active: false })} />}
    </>
  );
}
