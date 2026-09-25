import type { ReminderPlan } from '../platform';
import { api } from './api';

const ENDPOINT_KEY = 'mainline.push.endpoint';

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iOS only allows web push for Home-Screen apps (16.4+). */
export const iosNeedsHomeScreen = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches;

const state = (plan: ReminderPlan) => ({
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  reminderTime: plan.time,
  dueCount: plan.dueCount,
  streak: plan.streakDays,
  freezes: plan.freezesAtLast,
  lastReviewDay: plan.lastReviewDay,
});

/** Subscribes (asking permission when needed) or updates the server with the latest due count. */
export async function registerWebPush(plan: ReminderPlan): Promise<'scheduled' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  let endpoint: string | null = null;
  try {
    endpoint = localStorage.getItem(ENDPOINT_KEY);
  } catch {
    /* ignore */
  }
  if (!plan.enabled) {
    if (endpoint) {
      const reg = await navigator.serviceWorker.ready;
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      await api('/api/push/unsubscribe', { method: 'POST', json: { endpoint } }).catch(() => undefined);
      localStorage.removeItem(ENDPOINT_KEY);
    }
    return 'scheduled';
  }
  if (endpoint && Notification.permission === 'granted') {
    await api('/api/push/state', { method: 'POST', json: { endpoint, ...state(plan) } }).catch(() => undefined);
    return 'scheduled';
  }
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return 'denied';
  const { publicKey } = await api<{ publicKey: string }>('/api/push/vapid');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api('/api/push/subscribe', { method: 'POST', json: { subscription: { endpoint: json.endpoint, keys: json.keys }, ...state(plan) } });
  localStorage.setItem(ENDPOINT_KEY, json.endpoint);
  return 'scheduled';
}
