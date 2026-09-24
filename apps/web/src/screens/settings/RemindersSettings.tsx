import { useState } from 'react';
import { BellRing, Share } from 'lucide-react';
import { usePrefs } from '../../lib/prefs';
import { platform } from '../../platform';
import { iosNeedsHomeScreen, pushSupported } from '../../lib/push';
import { currentPlan } from '../../lib/reminders';
import { Toggle } from '../SettingsScreen';
import { toast } from '../../ui/toast';

export function RemindersSettings() {
  const p = usePrefs();
  const [busy, setBusy] = useState(false);
  const native = platform().isNative;
  const homeScreenHint = !native && iosNeedsHomeScreen();
  const unsupported = !native && !homeScreenHint && !pushSupported();

  const toggle = async (on: boolean) => {
    setBusy(true);
    p.set({ remindersOn: on, remindersEverEnabled: p.remindersEverEnabled || on });
    try {
      const res = await platform().scheduleReminders({ ...currentPlan(), enabled: on });
      if (on && res === 'denied') {
        p.set({ remindersOn: false });
        toast('Notifications are blocked — allow them in your browser or system settings.', { kind: 'error' });
      } else if (on && res === 'unsupported') {
        p.set({ remindersOn: false });
        toast('This browser can’t show reminders.', { kind: 'error' });
      } else if (on) toast(`Daily reminder set for ${p.reminderTime}`, { kind: 'success' });
    } catch (e) {
      p.set({ remindersOn: false });
      toast((e as Error).message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">Reminders</h2>
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
        {homeScreenHint ? (
          <div className="flex gap-3 px-4 py-3.5">
            <BellRing size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-ink-2">
              To get reminders on iPhone, add MainLine to your Home Screen first: tap <Share size={14} className="inline align-[-2px]" aria-label="Share" /> then <b>Add to Home Screen</b>, and open it from there.
            </p>
          </div>
        ) : unsupported ? (
          <p className="px-4 py-3.5 text-sm text-ink-2">This browser doesn’t support notifications. Install the app or use Chrome, Edge, Firefox or Safari.</p>
        ) : (
          <>
            <div aria-busy={busy}>
              <Toggle label="Daily reminder" hint="Only when positions are due. Plus a gentle nudge if your streak is at risk." checked={p.remindersOn} onChange={(v) => void toggle(v)} />
            </div>
            <div className="flex min-h-[56px] items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-base font-medium">Time</span>
              <input
                type="time"
                value={p.reminderTime}
                onChange={(e) => e.target.value && p.set({ reminderTime: e.target.value })}
                className="tnum h-10 rounded-[10px] border border-line bg-surface px-3 text-base font-semibold"
                aria-label="Reminder time"
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
