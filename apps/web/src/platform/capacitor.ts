import type { Platform } from './index';
import { createWebPlatform } from './web';

/** Capacitor (iOS / Android). Native plugins are wired in Phase 5. */
export function createCapacitorPlatform(kind: 'ios' | 'android'): Platform {
  const web = createWebPlatform();
  return { ...web, kind, isNative: true };
}
