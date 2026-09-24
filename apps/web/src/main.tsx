import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPlatform } from './platform';
import { App } from './App';
import './styles.css';
import { bindPrefsToDocument } from './lib/prefs';
import { installAudioUnlock } from './lib/sound';
import { useAuth } from './lib/auth';
import { useLibrary } from './lib/library';
import { useTraining } from './lib/training';
import { startSync } from './lib/sync';

await initPlatform();
bindPrefsToDocument();
installAudioUnlock();
void useAuth.getState().refresh();
void useLibrary.getState().load();
void useTraining.getState().load();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
