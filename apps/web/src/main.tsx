import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPlatform, platform } from './platform';
import { App, startPlatformHooks } from './App';
import './styles.css';
import { bindPrefsToDocument } from './lib/prefs';
import { installAudioUnlock } from './lib/sound';
import { useAuth } from './lib/auth';
import { useLibrary } from './lib/library';
import { useTraining } from './lib/training';
import { startSync } from './lib/sync';
import { startReminderSync } from './lib/reminders';

await initPlatform();
bindPrefsToDocument();
installAudioUnlock();
void useAuth.getState().refresh();
void useLibrary.getState().load();
void useTraining.getState().load();
startSync();
startReminderSync();
startPlatformHooks();

// Offline app shell + push (web / PWA only — native shells serve local files).
if (!platform().isNative && 'serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
