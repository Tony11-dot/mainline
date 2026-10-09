import { useState } from 'react';
import { BadgeCheck, LogOut, Minus, Plus, Trash2 } from 'lucide-react';
import { accountName, SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { RemindersSettings } from './settings/RemindersSettings';
import { LOCALES, intlLocale, msg, t } from '../lib/i18n';
import { syncNow, useSync } from '../lib/sync';
import { playSound } from '../lib/sound';
import { signInWithApple, startLogin, useAuth } from '../lib/auth';
import { platformKind } from '../platform';
import { legalUrl } from '../lib/legal';
import { speedName } from '../lib/speeds';
import { Button, Segmented } from '../ui/primitives';
import { FormRow, FormSection, PageHeader, Pill, Toggle } from '../ui/kit';
import { Sheet } from '../ui/Sheet';

export { Toggle };

// accountName() (shared) falls back to these when an account has no chess username.
msg('your Apple ID');
msg('your account');

export function SettingsScreen() {
  const p = usePrefs();
  const { me, logout, providers } = useAuth();
  const sync = useSync();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={t('Settings')} />

      <FormSection title={t('Account')}>
        {me ? (
          <>
            <FormRow label={t('Signed in as {name}', { name: t(accountName(me)) })} hint={syncHint(sync)} stack>
              <Button size="sm" variant="ghost" onClick={() => void syncNow()}>
                {t('Sync now')}
              </Button>
              <Button size="sm" icon={LogOut} onClick={() => void logout()}>
                {t('Sign out')}
              </Button>
            </FormRow>
            {me.chesscomVerified ? (
              <FormRow label="Chess.com" hint={t('Your games import from this account.')}>
                <Pill tone="good" icon={BadgeCheck} size="md">
                  {me.chesscomUsername}
                </Pill>
              </FormRow>
            ) : (
              providers.chesscom && (
                <FormRow label="Chess.com" hint={t('Link your Chess.com account to import your games from it.')} stack>
                  <Button size="sm" onClick={() => void startLogin('chesscom')}>
                    <ChessComMark /> {t('Connect Chess.com')}
                  </Button>
                </FormRow>
              )
            )}
          </>
        ) : (
          <div className="px-4 py-4">
            <div className="text-base font-medium">{t('Sign in to sync')}</div>
            <p className="text-sm text-ink-2">{t('Optional. Keeps your repertoire and training in step across devices. Everything works without an account.')}</p>
            <div className="mt-3.5 grid gap-2 sm:flex sm:flex-wrap">
              {platformKind === 'ios' && <AppleButton onClick={() => void signInWithApple()} />}
              <Button variant={platformKind === 'ios' ? 'secondary' : 'primary'} onClick={() => void startLogin('lichess')}>
                {t('Sign in with Lichess')}
              </Button>
              {providers.chesscom && (
                <Button onClick={() => void startLogin('chesscom')}>
                  <ChessComMark /> {t('Sign in with Chess.com')}
                </Button>
              )}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title={t('Your level')}>
        <FormRow label={t('Rating')} hint={t('Explorer stats and coverage use players around this rating.')}>
          <Stepper label={t('Rating')} value={p.rating} min={400} max={3200} step={50} onChange={(rating) => p.set({ rating })} />
        </FormRow>
        <FormRow label={t('New moves per day')} hint={t('How many new positions Learn introduces each day.')}>
          <Stepper label={t('New moves per day')} value={p.dailyNewLimit} min={0} max={100} step={1} onChange={(dailyNewLimit) => p.set({ dailyNewLimit })} />
        </FormRow>
        <FormRow label={t('Daily goal')} hint={t('Reviews per day for the goal ring on Today.')}>
          <Stepper label={t('Daily goal')} value={p.dailyGoal} min={1} max={500} step={5} onChange={(dailyGoal) => p.set({ dailyGoal })} />
        </FormRow>
        <FormRow label={t('Time controls')} stack>
          <div className="flex flex-wrap gap-1.5">
            {SPEEDS.filter((s) => s !== 'correspondence').map((s) => {
              const on = p.speeds.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? p.speeds.filter((x) => x !== s) : [...p.speeds, s];
                    if (next.length) p.set({ speeds: next as Speed[] });
                  }}
                  className={`pressable h-9 rounded-full px-3.5 text-sm font-semibold ${on ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}
                >
                  {speedName(s)}
                </button>
              );
            })}
          </div>
        </FormRow>
      </FormSection>

      <FormSection title={t('Language')}>
        <FormRow label={t('Language')} hint={t('Automatic follows your device language.')}>
          <select value={p.locale} onChange={(e) => p.set({ locale: e.target.value as typeof p.locale })} className="h-10 max-w-[12rem] rounded-[var(--radius-s)] border border-line bg-surface px-3 text-base text-ink" aria-label={t('Language')}>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id === 'auto' ? t('Automatic') : l.name}
              </option>
            ))}
          </select>
        </FormRow>
      </FormSection>

      <RemindersSettings />

      <AppearanceSettings />

      <FormSection title={t('Board & motion')}>
        <Toggle label={t('Coordinates')} checked={p.coordinates} onChange={(coordinates) => p.set({ coordinates })} />
        <Toggle label={t('Show legal moves')} checked={p.showDests} onChange={(showDests) => p.set({ showDests })} />
        <Toggle label={t('Reduce transparency')} hint={t('Solid backgrounds instead of glass.')} checked={p.reduceTransparency} onChange={(reduceTransparency) => p.set({ reduceTransparency })} />
        <FormRow label={t('Piece animation')} stack>
          <Segmented
            label={t('Piece animation')}
            value={String(p.animationMs)}
            onChange={(v) => p.set({ animationMs: Number(v) })}
            options={[
              { value: '0', label: t('Off') },
              { value: '120', label: t('Fast') },
              { value: '200', label: t('Normal') },
              { value: '300', label: t('Slow') },
            ]}
            className="w-full sm:w-72"
          />
        </FormRow>
      </FormSection>

      <FormSection title={t('Sound & touch')}>
        <Toggle
          label={t('Sounds')}
          checked={p.sound}
          onChange={(sound) => {
            p.set({ sound });
            if (sound) playSound('move');
          }}
        />
        <FormRow label={t('Volume')}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.volume}
            disabled={!p.sound}
            onChange={(e) => p.set({ volume: Number(e.target.value) })}
            onPointerUp={() => playSound('capture')}
            className="w-40 accent-[var(--brand)] disabled:opacity-45"
            aria-label={t('Volume')}
          />
        </FormRow>
        <Toggle label={t('Haptics')} hint={t('Vibration feedback on supported devices.')} checked={p.haptics} onChange={(haptics) => p.set({ haptics })} />
      </FormSection>

      <DeleteData signedIn={!!me} />

      <p className="mt-6 text-center text-xs text-ink-3">
        {(
          [
            ['/privacy', msg('Privacy policy')],
            ['/terms', msg('Terms of use')],
            ['/cookies', msg('Cookies')],
            ['/accessibility', msg('Accessibility')],
          ] as const
        ).map(([path, label], i) => (
          <span key={path}>
            {i > 0 && ' · '}
            <a href={legalUrl(path)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {t(label)}
            </a>
          </span>
        ))}
      </p>

      <p className="mt-3 text-center text-xs text-ink-3">
        {t('MainLine is free software (GPL-3.0). Board by chessground, rules by chessops, engine Stockfish 19 — all GPL-3.0.')}{' '}
        {t('Opening names from lichess-org/chess-openings (CC0).')}{' '}
        {t('Cabinet Grotesk © Indian Type Foundry, used under the ITF Free Font License.')}
      </p>
    </div>
  );
}

/** App Store 5.1.1(v): account deletion inside the app. Guests can erase this device. */
function DeleteData({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleteEverything = useAuth((s) => s.deleteEverything);
  const label = signedIn ? t('Delete my account & data') : t('Erase all data on this device');
  return (
    <FormSection title={t('Your data')}>
      <FormRow
        label={label}
        hint={signedIn ? t('Removes your MainLine account, synced repertoires and training history, and disconnects Lichess.') : t('Removes your repertoires, training history and settings from this device.')}
        stack
      >
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
          {signedIn ? t('Delete account') : t('Erase data')}
        </Button>
      </FormRow>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={label}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await deleteEverything();
                  location.replace('/');
                } catch {
                  setBusy(false);
                  setError(t('Couldn’t reach the server. Check your connection and try again — nothing was deleted.'));
                }
              }}
            >
              {t('Delete permanently')}
            </Button>
          </>
        }
      >
        <p className="text-ink-2">{t('This can’t be undone.')} {signedIn ? t('Everything on the server and on this device is deleted; other devices keep their local copy until you erase them too.') : t('Export your repertoires as PGN first if you want to keep them.')}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-bad-ink">
            {error}
          </p>
        )}
      </Sheet>
    </FormSection>
  );
}

/** − value + : taps for the usual nudge, and the number itself can still be typed (committed on blur / Enter). */
function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(clamp(Math.round(Number(draft))));
    setDraft(null);
  };
  const nudge = (dir: 1 | -1) => onChange(clamp(dir > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step));
  const btn = 'flex size-11 items-center justify-center text-ink-2 transition-colors duration-[var(--dur-fast)] hover:bg-surface-3 hover:text-ink active:bg-surface-3 disabled:pointer-events-none disabled:opacity-35';
  return (
    <div className="flex h-11 items-center overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface-2">
      <button type="button" className={btn} aria-label={t('Decrease {setting}', { setting: label })} disabled={value <= min} onClick={() => nudge(-1)}>
        <Minus size={16} strokeWidth={2.4} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="tnum h-full w-[3.75rem] border-x border-line bg-surface text-center text-base font-semibold text-ink outline-none focus:bg-brand-softer"
      />
      <button type="button" className={btn} aria-label={t('Increase {setting}', { setting: label })} disabled={value >= max} onClick={() => nudge(1)}>
        <Plus size={16} strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}

function syncHint(s: ReturnType<typeof useSync.getState>): string {
  if (s.status === 'syncing') return t('Syncing…');
  if (s.status === 'offline') return t('Offline — changes are saved here and will sync when you’re back online.');
  if (s.status === 'error') return t('Sync problem: {error} — retrying automatically.', { error: s.error ?? t('unknown') });
  if (s.lastSyncedAt) return t('Synced {time} · repertoire and training follow you across devices.', { time: new Date(s.lastSyncedAt).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) });
  return t('Your repertoire and training sync across devices.');
}

/** Apple's button style (HIG): black (white in dark mode), Apple logo, "Sign in with Apple". */
function AppleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-black px-4 text-base font-semibold text-white dark:bg-white dark:text-black"
    >
      <svg viewBox="0 0 17 20" className="size-[17px] -translate-y-px" aria-hidden>
        <path
          fill="currentColor"
          d="M14.06 10.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76A4.24 4.24 0 0 0 2.98 7.8c-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13a9.5 9.5 0 0 0 1.2-2.47 3.84 3.84 0 0 1-2.3-3.47ZM11.88 4.16A3.8 3.8 0 0 0 12.77 1.4a3.9 3.9 0 0 0-2.52 1.3 3.63 3.63 0 0 0-.92 2.67 3.21 3.21 0 0 0 2.55-1.21Z"
        />
      </svg>
      {t('Sign in with Apple')}
    </button>
  );
}

/** A neutral pawn glyph for Chess.com buttons (their logo is trademarked, so no brand artwork). */
function ChessComMark() {
  return (
    <svg viewBox="0 0 24 24" className="me-1.5 size-4" aria-hidden>
      <path fill="currentColor" d="M12 2a3.5 3.5 0 0 0-2.2 6.2C8.6 9 8 10.2 8 11.5c0 .9.3 1.7.8 2.3L7 19h10l-1.8-5.2c.5-.6.8-1.4.8-2.3 0-1.3-.6-2.5-1.8-3.3A3.5 3.5 0 0 0 12 2Zm-6 18.5A1.5 1.5 0 0 0 7.5 22h9a1.5 1.5 0 0 0 1.5-1.5V20H6v.5Z" />
    </svg>
  );
}
