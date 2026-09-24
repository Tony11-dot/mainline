import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPlatform } from './platform';
import { App } from './App';
import './styles.css';
import { bindPrefsToDocument } from './lib/prefs';
import { installAudioUnlock } from './lib/sound';
import { useAuth } from './lib/auth';

await initPlatform();
bindPrefsToDocument();
installAudioUnlock();
void useAuth.getState().refresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
