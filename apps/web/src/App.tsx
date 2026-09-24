import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './ui/AppShell';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'library', element: <PlaceholderScreen title="Repertoire" /> },
      { path: 'explore', element: <PlaceholderScreen title="Explore" /> },
      { path: 'games', element: <PlaceholderScreen title="Games" /> },
      { path: 'settings', element: <PlaceholderScreen title="Settings" /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
