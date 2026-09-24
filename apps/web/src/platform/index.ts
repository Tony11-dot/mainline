/**
 * Platform adapter: the only place that knows whether we run in a browser, a Capacitor app or a Tauri app.
 * Everything else calls `platform.*`.
 */
export type PlatformKind = 'web' | 'ios' | 'android' | 'desktop';
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

export interface ReminderPlan {
  /** Local time "HH:MM" */
  time: string;
  dueCount: number;
  streakDays: number;
}

export interface Platform {
  kind: PlatformKind;
  isNative: boolean;
  /** Base URL of the API ('' = same origin). */
  apiBase: string;
  haptic(kind: HapticKind): void;
  /** Schedule local reminders (native) or register web push (web). */
  scheduleReminders(plan: ReminderPlan): Promise<'scheduled' | 'denied' | 'unsupported'>;
  share(data: { title: string; text?: string; url?: string; file?: { name: string; content: string } }): Promise<boolean>;
  openFile(accept: string[]): Promise<{ name: string; content: string } | null>;
  saveFile(name: string, content: string, mime?: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** Called with URLs the OS hands us (deep links, OAuth callbacks, shared files). */
  onIncoming(cb: (incoming: { url?: string; text?: string; fileName?: string }) => void): void;
}

declare global {
  interface Window {
    Capacitor?: { isNativePlatform(): boolean; getPlatform(): string };
    __TAURI_INTERNALS__?: unknown;
  }
}

function detect(): PlatformKind {
  if (typeof window === 'undefined') return 'web';
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform() === 'ios' ? 'ios' : 'android';
  if (window.__TAURI_INTERNALS__) return 'desktop';
  return 'web';
}

export const platformKind: PlatformKind = detect();

let impl: Platform | undefined;

export async function initPlatform(): Promise<Platform> {
  if (impl) return impl;
  if (platformKind === 'ios' || platformKind === 'android') {
    impl = (await import('./capacitor')).createCapacitorPlatform(platformKind);
  } else if (platformKind === 'desktop') {
    impl = (await import('./tauri')).createTauriPlatform();
  } else {
    impl = (await import('./web')).createWebPlatform();
  }
  return impl;
}

/** Synchronous access after initPlatform() resolved (it runs before first render). */
export function platform(): Platform {
  if (!impl) throw new Error('platform not initialised');
  return impl;
}
