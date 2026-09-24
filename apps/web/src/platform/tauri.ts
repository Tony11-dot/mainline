import type { Platform } from './index';
import { createWebPlatform } from './web';

/** Tauri desktop. Native plugins are wired in Phase 5. */
export function createTauriPlatform(): Platform {
  const web = createWebPlatform();
  return { ...web, kind: 'desktop', isNative: true };
}
