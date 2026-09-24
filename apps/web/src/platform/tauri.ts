import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { getCurrent as getCurrentDeepLinks, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Platform, ReminderPlan } from './index';
import { apiBaseFromEnv } from './web';

/**
 * Desktop (Tauri 2: Windows / macOS / Linux). Desktop notifications can't be pre-scheduled, so while
 * the app runs a minute timer fires the daily reminder at the chosen time (once per day).
 */
export function createTauriPlatform(): Platform {
  const handlers: ((i: { url?: string; text?: string; fileName?: string }) => void)[] = [];
  const queued: { url?: string; text?: string; fileName?: string }[] = [];
  const emit = (i: { url?: string; text?: string; fileName?: string }) => (handlers.length ? handlers.forEach((h) => h(i)) : queued.push(i));

  void onOpenUrl((urls) => urls.forEach((url) => emit({ url })));
  void getCurrentDeepLinks().then((urls) => urls?.forEach((url) => emit({ url })));
  void listen<{ name: string; text: string }>('mainline://open-file', (e) => emit({ text: e.payload.text, fileName: e.payload.name }));

  if (/Mac/.test(navigator.userAgent)) document.documentElement.dataset.macos = '';

  let plan: ReminderPlan | null = null;
  let firedOn = '';
  setInterval(async () => {
    if (!plan?.enabled) return;
    const now = new Date();
    const day = now.toDateString();
    const [h, m] = plan.time.split(':').map(Number);
    if (firedOn === day || now.getHours() !== h || now.getMinutes() < (m ?? 0)) return;
    firedOn = day;
    if (plan.dueCount > 0 && (await isPermissionGranted())) {
      sendNotification({ title: `${plan.dueCount} position${plan.dueCount === 1 ? '' : 's'} due`, body: `About ${Math.max(1, Math.round((plan.dueCount * 8) / 60))} min to keep your openings sharp.` });
    }
  }, 30_000);

  // Quietly check for updates (signed with the updater key; unsigned OS builds still update).
  setTimeout(async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        const { relaunch } = await import('@tauri-apps/plugin-process');
        if (confirm(`MainLine ${update.version} is ready. Restart now?`)) await relaunch();
      }
    } catch {
      /* offline or no release yet */
    }
  }, 8000);

  return {
    kind: 'desktop',
    isNative: true,
    apiBase: apiBaseFromEnv(),
    haptic() {
      /* no haptics on desktop */
    },
    async scheduleReminders(p) {
      plan = p;
      if (!p.enabled) return 'scheduled';
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      return granted ? 'scheduled' : 'denied';
    },
    async share(data) {
      if (data.file) {
        await this.saveFile(data.file.name, data.file.content);
        return true;
      }
      await navigator.clipboard.writeText(data.url ?? data.text ?? '');
      return true;
    },
    openFile(accept) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.onchange = async () => {
          const f = input.files?.[0];
          resolve(f ? { name: f.name, content: await f.text() } : null);
        };
        input.click();
      });
    },
    async saveFile(name, content) {
      const path = await save({ defaultPath: name, filters: [{ name: 'PGN', extensions: ['pgn'] }] });
      if (path) await writeTextFile(path, content);
    },
    async openExternal(url) {
      await openUrl(url);
    },
    onIncoming(cb) {
      handlers.push(cb);
      queued.splice(0).forEach(cb);
    },
  };
}
