import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { HapticKind, Platform, ReminderPlan } from './index';
import { apiBaseFromEnv } from './web';

/** Reminder notification ids: 1000 + day × 10 + slot (see plannedNotifications); 100–107 and 200 are from older builds. */
const REMINDER_IDS = [...Array.from({ length: 80 }, (_, i) => 1000 + i), 100, 101, 102, 103, 104, 105, 106, 107, 200];

/** iOS + Android (Capacitor). Reminders are local notifications scheduled on the device — no server. */
export function createCapacitorPlatform(kind: 'ios' | 'android'): Platform {
  const handlers: ((i: { url?: string; text?: string; fileName?: string }) => void)[] = [];
  const queued: { url?: string; text?: string; fileName?: string }[] = [];
  const emit = (i: { url?: string; text?: string; fileName?: string }) => (handlers.length ? handlers.forEach((h) => h(i)) : queued.push(i));

  // Deep links (OAuth return, app.mainline.chess://…) and files opened with the app ("Open in MainLine").
  void App.addListener('appUrlOpen', async ({ url }) => {
    if (/^(file|content):/.test(url) || /\.pgn($|\?)/i.test(url)) {
      try {
        const { data } = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
        emit({ text: String(data), fileName: decodeURIComponent(url.split('/').pop() ?? 'shared.pgn') });
      } catch {
        emit({ url });
      }
      return;
    }
    emit({ url });
  });
  void App.getLaunchUrl().then((l) => l?.url && emit({ url: l.url }));

  // Android: hardware back navigates the app, then leaves it.
  if (kind === 'android') {
    void App.addListener('backButton', ({ canGoBack }) => (canGoBack ? history.back() : void App.exitApp()));
  }

  // Edge-to-edge with the status bar matching the theme.
  const syncStatusBar = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    if (kind === 'android') void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  };
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  syncStatusBar();
  // The web launch animation takes over from the native splash seamlessly.
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 180 }).catch(() => undefined));

  return {
    kind,
    isNative: true,
    apiBase: apiBaseFromEnv(),

    haptic(k: HapticKind) {
      const run = () => {
        switch (k) {
          case 'selection':
            return Haptics.selectionChanged();
          case 'light':
            return Haptics.impact({ style: ImpactStyle.Light });
          case 'medium':
            return Haptics.impact({ style: ImpactStyle.Medium });
          case 'success':
            return Haptics.notification({ type: NotificationType.Success });
          case 'warning':
            return Haptics.notification({ type: NotificationType.Warning });
          case 'error':
            return Haptics.notification({ type: NotificationType.Error });
        }
      };
      void run()?.catch(() => undefined);
    },

    async scheduleReminders(plan: ReminderPlan) {
      await LocalNotifications.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) }).catch(() => undefined);
      if (!plan.enabled) return 'scheduled';
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return 'denied';
      const { plannedNotifications } = await import('../lib/reminders');
      const notifications = plannedNotifications(plan).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        smallIcon: 'ic_stat_mainline',
        threadIdentifier: n.tag,
        group: n.tag,
        extra: { url: n.url },
      }));
      if (notifications.length) await LocalNotifications.schedule({ notifications });
      return 'scheduled';
    },

    async share(data) {
      if (data.file) {
        const written = await Filesystem.writeFile({ path: data.file.name, data: data.file.content, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: data.title, files: [written.uri], dialogTitle: data.title });
        return true;
      }
      await Share.share({ title: data.title, text: data.text, url: data.url });
      return true;
    },

    openFile(accept) {
      // The web file picker works inside the native web views (it opens Files / the document picker).
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
      const written = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Documents, encoding: Encoding.UTF8 });
      await Share.share({ title: name, files: [written.uri] }).catch(() => undefined);
    },

    async openExternal(url) {
      await Browser.open({ url, presentationStyle: 'popover' });
    },

    onIncoming(cb) {
      handlers.push(cb);
      queued.splice(0).forEach(cb);
    },
  };
}

/** Tapping a reminder opens training. */
export function bindNotificationTaps(navigate: (url: string) => void) {
  void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    navigate((a.notification.extra as { url?: string } | undefined)?.url ?? '/train?mode=review');
  });
}

export const closeInAppBrowser = () => Browser.close().catch(() => undefined);
