import type { HapticKind, Platform } from './index';

const VIBRATE: Record<HapticKind, number | number[]> = {
  selection: 6,
  light: 8,
  medium: 14,
  success: [8, 40, 8],
  warning: [14, 60, 14],
  error: [20, 50, 20, 50, 20],
};

export function apiBaseFromEnv(): string {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

export function createWebPlatform(): Platform {
  const incomingHandlers: ((i: { url?: string; text?: string; fileName?: string }) => void)[] = [];
  return {
    kind: 'web',
    isNative: false,
    apiBase: apiBaseFromEnv(),
    haptic(kind) {
      // Android Chrome supports vibrate; iOS Safari ignores it. Keep it subtle.
      try {
        navigator.vibrate?.(VIBRATE[kind]);
      } catch {
        /* ignore */
      }
    },
    async scheduleReminders(plan) {
      const { registerWebPush } = await import('../lib/push');
      return registerWebPush(plan);
    },
    async share(data) {
      if (data.file && 'canShare' in navigator) {
        const file = new File([data.file.content], data.file.name, { type: 'application/x-chess-pgn' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: data.title, files: [file] });
          return true;
        }
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: data.title, text: data.text, url: data.url });
          return true;
        } catch {
          return false;
        }
      }
      if (data.file) {
        await this.saveFile(data.file.name, data.file.content);
        return true;
      }
      await navigator.clipboard?.writeText(data.url ?? data.text ?? '');
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
        input.oncancel = () => resolve(null);
        input.click();
      });
    },
    async saveFile(name, content, mime = 'application/x-chess-pgn') {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async openExternal(url) {
      window.open(url, '_blank', 'noopener');
    },
    onIncoming(cb) {
      incomingHandlers.push(cb);
      // PWA share target / file handler launch params land here.
      const params = new URLSearchParams(location.search);
      const text = params.get('share_text') ?? params.get('text');
      if (text) cb({ text });
    },
  };
}
