import { useState, type ReactNode } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { RemindersSettings } from './settings/RemindersSettings';
import { LOCALES, useT } from '../lib/i18n';
import { syncNow, useSync } from '../lib/sync';
import { playSound } from '../lib/sound';
import { startLichessLogin, useAuth } from '../lib/auth';
import { Button, Segmented } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

export function SettingsScreen() {
  const p = usePrefs();
  const { me, logout } = useAuth();
  const sync = useSync();
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Group title="Account">
        {me ? (
          <Row label={`Signed in as ${me.lichessUsername}`} hint={syncHint(sync)}>
            <Button size="sm" variant="ghost" onClick={() => void syncNow()} className="mr-1">
              Sync now
            </Button>
            <Button size="sm" icon={LogOut} onClick={() => void logout()}>
              Sign out
            </Button>
          </Row>
        ) : (
          <Row label="Lichess account" hint="Optional. Syncs your repertoire and unlocks explorer stats at your rating.">
            <Button size="sm" variant="primary" onClick={() => startLichessLogin()}>
              Sign in with Lichess
            </Button>
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
        <a href={legalUrl('/privacy')} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Privacy
        </a>
        {' · '}
        <a href={legalUrl('/terms')} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Terms
        </a>
      </p>

      <p className="mt-3 text-center text-xs text-ink-3">
        MainLine is free software (GPL-3.0). Board by chessground, rules by chessops, engine Stockfish 19 — all GPL-3.0.
        Opening names from lichess-org/chess-openings (CC0).
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

function legalUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return base + path;
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
