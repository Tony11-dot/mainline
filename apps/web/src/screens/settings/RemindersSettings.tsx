import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { usePrefs } from '../../lib/prefs';
import { platform } from '../../platform';
import { iosNeedsHomeScreen, pushSupported } from '../../lib/push';
import { currentPlan } from '../../lib/reminders';
import { FormRow, FormSection, Toggle } from '../../ui/kit';
import { toast } from '../../ui/toast';
import { t } from '../../lib/i18n';

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
        toast(t('Notifications are blocked — allow them in your browser or system settings.'), { kind: 'error' });
      } else if (on && res === 'unsupported') {
        p.set({ remindersOn: false });
        toast(t('This browser can’t show reminders.'), { kind: 'error' });
      } else if (on) toast(t('Daily reminder set for {time}', { time: p.reminderTime }), { kind: 'success' });
    } catch (e) {
      p.set({ remindersOn: false });
      toast((e as Error).message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSection title={t('Reminders')} id="reminders" className="scroll-mt-6">
        {homeScreenHint ? (
          <div className="flex gap-3 px-5 py-4">
            <BellRing size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-ink-2">
              {t('To get reminders on iPhone, add MainLine to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.')}
            </p>
          </div>
        ) : unsupported ? (
          <p className="px-5 py-4 text-sm text-ink-2">{t('This browser doesn’t support notifications. Install the app or use Chrome, Edge, Firefox or Safari.')}</p>
        ) : (
          <>
            <div aria-busy={busy}>
              <Toggle label={t('Streak reminders')} hint={t('Daily at this time, plus an evening nudge and a last call if your streak is at risk. Stops once you’ve practised.')} checked={p.remindersOn} onChange={(v) => void toggle(v)} />
            </div>
            <FormRow label={t('Time')}>
              <input
                type="time"
                value={p.reminderTime}
                onChange={(e) => e.target.value && p.set({ reminderTime: e.target.value })}
                className="tnum h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-base font-semibold text-ink"
                aria-label={t('Reminder time')}
              />
            </FormRow>
          </>
        )}
    </FormSection>
  );
}
