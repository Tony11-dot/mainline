import { createBrowserRouter, RouterProvider } from 'react-router';
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
  return (
    <>
      <RouterProvider router={router} />
      {launching && <LaunchScreen onDone={() => useLaunch.setState({ active: false })} />}
    </>
  );
}
