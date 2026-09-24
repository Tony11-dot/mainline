import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './ui/AppShell';
import { LaunchScreen, shouldShowLaunch } from './launch/LaunchScreen';
import { platform } from './platform';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { RepertoireScreen } from './screens/RepertoireScreen';
import { OpeningsScreen } from './screens/OpeningsScreen';
import { TrainScreen } from './screens/TrainScreen';

const router = createBrowserRouter([
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

export function App() {
  const [launching, setLaunching] = useState(() => shouldShowLaunch(platform().isNative));
  return (
    <>
      <RouterProvider router={router} />
      {launching && <LaunchScreen onDone={() => setLaunching(false)} />}
    </>
  );
}
