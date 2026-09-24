import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './ui/AppShell';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { RepertoireScreen } from './screens/RepertoireScreen';
import { OpeningsScreen } from './screens/OpeningsScreen';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'library/openings', element: <OpeningsScreen /> },
      { path: 'rep/:id', element: <RepertoireScreen /> },
      { path: 'explore', element: <ExploreScreen /> },
      { path: 'games', element: <PlaceholderScreen title="Games" /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
