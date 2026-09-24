import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { playSound } from '../lib/sound';
import { startLichessLogin, useAuth } from '../lib/auth';
import { Button, Segmented } from '../ui/primitives';

export function SettingsScreen() {
  const p = usePrefs();
  const { me, logout } = useAuth();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Group title="Account">
        {me ? (
          <Row label={`Signed in as ${me.lichessUsername}`} hint="Your repertoire syncs across devices.">
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

      <p className="mt-10 text-center text-xs text-ink-3">
        Mainline is free software (GPL-3.0). Board by chessground, rules by chessops, engine Stockfish 19 — all GPL-3.0.
        Opening names from lichess-org/chess-openings (CC0).
      </p>
    </div>
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
