import type { ReminderPlan } from '../platform';

/** Web Push registration — implemented in Phase 5. */
export async function registerWebPush(_plan: ReminderPlan): Promise<'scheduled' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
