import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './ui/AppShell';
import { LaunchScreen, shouldShowLaunch } from './launch/LaunchScreen';
import { platform } from './platform';
import { handleIncoming } from './lib/incomingHandler';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { RepertoireScreen } from './screens/RepertoireScreen';
import { OpeningsScreen } from './screens/OpeningsScreen';
import { TrainScreen } from './screens/TrainScreen';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'library/openings', element: <OpeningsScreen /> },
      { path: 'rep/:id', element: <RepertoireScreen /> },
      { path: 'train', element: <TrainScreen /> },
      { path: 'explore', element: <ExploreScreen /> },
      { path: 'games', element: <PlaceholderScreen title="Games" /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

/** OS integrations that need the router. Called by main.tsx after initPlatform() (never at import time). */
export function startPlatformHooks() {
  // Deep links, OAuth returns, files and notification taps from the OS.
  platform().onIncoming((i) => void handleIncoming((to) => void router.navigate(to))(i));
  if (platform().kind === 'ios' || platform().kind === 'android') {
    void import('./platform/capacitor').then((m) => m.bindNotificationTaps((to) => void router.navigate(to)));
  }
  if (platform().kind === 'ios') void import('./platform/nativeChrome').then((m) => m.startNativeChrome(router));
}

export function App() {
  const [launching, setLaunching] = useState(() => shouldShowLaunch(platform().isNative));
  return (
    <>
      <RouterProvider router={router} />
      {launching && <LaunchScreen onDone={() => setLaunching(false)} />}
    </>
  );
}
