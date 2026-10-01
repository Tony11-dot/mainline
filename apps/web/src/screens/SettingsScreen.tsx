import { useState, type ReactNode } from 'react';
import { BadgeCheck, LogOut, Trash2 } from 'lucide-react';
import { accountName, SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { RemindersSettings } from './settings/RemindersSettings';
import { LOCALES, useT } from '../lib/i18n';
import { syncNow, useSync } from '../lib/sync';
import { playSound } from '../lib/sound';
import { signInWithApple, startLogin, useAuth } from '../lib/auth';
import { platformKind } from '../platform';
import { legalUrl } from '../lib/legal';
import { Button, Segmented } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

export function SettingsScreen() {
  const p = usePrefs();
  const { me, logout, providers } = useAuth();
  const sync = useSync();
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Group title="Account">
        {me ? (
          <>
            <Row label={`Signed in as ${accountName(me)}`} hint={syncHint(sync)}>
              <Button size="sm" variant="ghost" onClick={() => void syncNow()} className="mr-1">
                Sync now
              </Button>
              <Button size="sm" icon={LogOut} onClick={() => void logout()}>
                Sign out
              </Button>
            </Row>
            {me.chesscomVerified ? (
              <Row label="Chess.com" hint="Your games import from this account.">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
                  <BadgeCheck size={16} aria-hidden /> {me.chesscomUsername}
                </span>
              </Row>
            ) : (
              providers.chesscom && (
                <Row label="Chess.com" hint="Link your Chess.com account to import your games from it.">
                  <Button size="sm" onClick={() => void startLogin('chesscom')}>
                    <ChessComMark /> Connect Chess.com
                  </Button>
                </Row>
              )
            )}
          </>
        ) : (
          <Row label="Account" hint="Optional. Syncs your repertoire across devices and imports your games.">
            <div className="flex flex-wrap justify-end gap-2">
              {platformKind === 'ios' && <AppleButton onClick={() => void signInWithApple()} />}
              <Button size="sm" variant="primary" onClick={() => void startLogin('lichess')}>
                Sign in with Lichess
              </Button>
              {providers.chesscom && (
                <Button size="sm" onClick={() => void startLogin('chesscom')}>
                  <ChessComMark /> Sign in with Chess.com
                </Button>
              )}
            </div>
          </Row>
        )}
      </Group>

      <Group title="Your level">
        <Row label="Rating" hint="Explorer stats and coverage use players around this rating.">
          <input
            type="number"
            inputMode="numeric"
            min={400}
            max={3200}
            step={50}
            value={p.rating}
            onChange={(e) => p.set({ rating: Math.max(400, Math.min(3200, Number(e.target.value) || 1500)) })}
            className="tnum h-10 w-24 rounded-[10px] border border-line bg-surface px-3 text-right text-base font-semibold"
            aria-label="Rating"
          />
        </Row>
        <Row label="New moves per day" hint="How many new positions Learn introduces each day.">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={p.dailyNewLimit}
            onChange={(e) => p.set({ dailyNewLimit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className="tnum h-10 w-20 rounded-[10px] border border-line bg-surface px-3 text-right text-base font-semibold"
            aria-label="New moves per day"
          />
        </Row>
        <Row label="Daily goal" hint="Reviews per day for the goal ring on Today.">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={p.dailyGoal}
            onChange={(e) => p.set({ dailyGoal: Math.max(1, Math.min(500, Number(e.target.value) || 20)) })}
            className="tnum h-10 w-20 rounded-[10px] border border-line bg-surface px-3 text-right text-base font-semibold"
            aria-label="Daily goal"
          />
        </Row>
        <Row label="Time controls" stack>
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
                  className={`h-9 rounded-full px-3.5 text-sm font-semibold capitalize transition-colors ${on ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Row>
      </Group>

      <section className="mt-8">
        <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">{t('settings.language')}</h2>
        <div className="overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
          <Row label={t('settings.language')} hint="Hebrew and Arabic are previews of the right-to-left layout.">
            <select value={p.locale} onChange={(e) => p.set({ locale: e.target.value as typeof p.locale })} className="h-10 rounded-[10px] border border-line bg-surface px-3 text-base" aria-label={t('settings.language')}>
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>
        </div>
      </section>

      <RemindersSettings />

      <AppearanceSettings />

      <Group title="Board & motion">
        <Toggle label="Coordinates" checked={p.coordinates} onChange={(coordinates) => p.set({ coordinates })} />
        <Toggle label="Show legal moves" checked={p.showDests} onChange={(showDests) => p.set({ showDests })} />
        <Toggle label="Reduce transparency" hint="Solid backgrounds instead of glass." checked={p.reduceTransparency} onChange={(reduceTransparency) => p.set({ reduceTransparency })} />
        <Row label="Piece animation">
          <Segmented
            label="Piece animation"
            value={String(p.animationMs)}
            onChange={(v) => p.set({ animationMs: Number(v) })}
            options={[
              { value: '0', label: 'Off' },
              { value: '120', label: 'Fast' },
              { value: '200', label: 'Normal' },
              { value: '300', label: 'Slow' },
            ]}
            className="w-64"
          />
        </Row>
      </Group>

      <Group title="Sound & touch">
        <Toggle
          label="Sounds"
          checked={p.sound}
          onChange={(sound) => {
            p.set({ sound });
            if (sound) playSound('move');
          }}
        />
        <Row label="Volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.volume}
            disabled={!p.sound}
            onChange={(e) => p.set({ volume: Number(e.target.value) })}
            onPointerUp={() => playSound('capture')}
            className="w-40 accent-[var(--brand)]"
            aria-label="Volume"
          />
        </Row>
        <Toggle label="Haptics" hint="Vibration feedback on supported devices." checked={p.haptics} onChange={(haptics) => p.set({ haptics })} />
      </Group>

      <DeleteData signedIn={!!me} />

      <p className="mt-6 text-center text-xs text-ink-3">
        {(
          [
            ['/privacy', 'Privacy policy'],
            ['/terms', 'Terms of use'],
            ['/cookies', 'Cookies'],
          ] as const
        ).map(([path, label], i) => (
          <span key={path}>
            {i > 0 && ' · '}
            <a href={legalUrl(path)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {label}
            </a>
          </span>
        ))}
      </p>

      <p className="mt-3 text-center text-xs text-ink-3">
        MainLine is free software (GPL-3.0). Board by chessground, rules by chessops, engine Stockfish 19 — all GPL-3.0.
        Opening names from lichess-org/chess-openings (CC0).
        Cabinet Grotesk © Indian Type Foundry, used under the ITF Free Font License.
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
  const label = signedIn ? 'Delete my account & data' : 'Erase all data on this device';
  return (
    <Group title="Your data">
      <Row
        label={label}
        hint={signedIn ? 'Removes your MainLine account, synced repertoires and training history, and disconnects Lichess.' : 'Removes your repertoires, training history and settings from this device.'}
        stack
      >
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
          {signedIn ? 'Delete account' : 'Erase data'}
        </Button>
      </Row>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={label}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
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
                  setError("Couldn't reach the server. Check your connection and try again — nothing was deleted.");
                }
              }}
            >
              Delete permanently
            </Button>
          </div>
        }
      >
        <p className="text-ink-2">This can't be undone. {signedIn ? 'Everything on the server and on this device is deleted; other devices keep their local copy until you erase them too.' : 'Export your repertoires as PGN first if you want to keep them.'}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </Sheet>
    </Group>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, stack }: { label: string; hint?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex min-h-[56px] gap-x-4 gap-y-2.5 px-4 py-2.5 ${stack ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'items-center justify-between'}`}>
      <div className="min-w-0">
        <div className="text-base font-medium">{label}</div>
        {hint && <div className="text-sm text-ink-2">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="h-[31px] w-[51px] rounded-full bg-surface-3 transition-colors duration-200 peer-checked:bg-good peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-2 transition-transform duration-200 ease-[var(--ease-out)] peer-checked:translate-x-[20px]" />
      </label>
    </Row>
  );
}

function syncHint(s: ReturnType<typeof useSync.getState>): string {
  if (s.status === 'syncing') return 'Syncing…';
  if (s.status === 'offline') return 'Offline — changes are saved here and will sync when you’re back online.';
  if (s.status === 'error') return `Sync problem: ${s.error ?? 'unknown'} — retrying automatically.`;
  if (s.lastSyncedAt) return `Synced ${new Date(s.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · repertoire and training follow you across devices.`;
  return 'Your repertoire and training sync across devices.';
}

/** Apple's button style (HIG): black (white in dark mode), Apple logo, "Sign in with Apple". */
function AppleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-black px-3 text-sm font-semibold text-white active:opacity-80 dark:bg-white dark:text-black"
    >
      <svg viewBox="0 0 17 20" className="size-[15px]" aria-hidden>
        <path
          fill="currentColor"
          d="M14.06 10.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76A4.24 4.24 0 0 0 2.98 7.8c-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13a9.5 9.5 0 0 0 1.2-2.47 3.84 3.84 0 0 1-2.3-3.47ZM11.88 4.16A3.8 3.8 0 0 0 12.77 1.4a3.9 3.9 0 0 0-2.52 1.3 3.63 3.63 0 0 0-.92 2.67 3.21 3.21 0 0 0 2.55-1.21Z"
        />
      </svg>
      Sign in with Apple
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
