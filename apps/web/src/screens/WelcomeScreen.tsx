import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { useLibrary } from '../lib/library';
import { PACKS, addPack, mainLineText } from '../lib/packs';
import { Button } from '../ui/primitives';
import { LogoMark, Wordmark } from '../ui/Logo';
import { MiniBoard } from '../ui/MiniBoard';
import { legalUrl } from '../lib/legal';
import { parseSanLine } from './library/sanLine';
import { speedName } from '../lib/speeds';
import { msg, t, tx } from '../lib/i18n';

const LEVELS = [
  { label: msg('New to openings'), rating: 900 },
  { label: '1000 – 1400', rating: 1200 },
  { label: '1400 – 1800', rating: 1600 },
  { label: '1800 – 2200', rating: 2000 },
  { label: '2200+', rating: 2300 },
];

/** First run: level → starter repertoires → straight into Learn. Everything can be changed later. */
export function WelcomeScreen() {
  const [step, setStep] = useState(0);
  const p = usePrefs();
  const lib = useLibrary();
  const nav = useNavigate();
  const [picked, setPicked] = useState<Set<string>>(new Set(['w-italian', 'b-caro']));
  const [busy, setBusy] = useState(false);

  const finish = async (withTemplates: boolean) => {
    setBusy(true);
    await lib.load();
    if (withTemplates) {
      for (const p of PACKS.filter((x) => picked.has(x.id))) await addPack(p);
    }
    p.set({ onboarded: true });
    nav(withTemplates && picked.size ? '/train?mode=learn' : '/library', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col justify-center px-5 py-10">
      <div className="mb-8 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-surface-3'}`} />
        ))}
      </div>

      {step === 0 && (
        <section aria-labelledby="w0">
          <LogoMark size={64} />
          <h1 id="w0" className="mt-6 text-4xl font-bold tracking-tight">
            {t('Master your openings, branch by branch.')}
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-2">
            {t('Build a repertoire like a tree of lines, understand every move with real statistics and a coach, and remember it with spaced repetition — on every device.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={() => setStep(1)}>
              {t('Get started')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => void finish(false)}>
              {t('Skip')}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="w1">
          <h1 id="w1" className="text-3xl font-bold">
            {t('What’s your level?')}
          </h1>
          <p className="mt-2 text-md text-ink-2">{t('Statistics and suggestions use players around your rating.')}</p>
          <div className="mt-6 flex flex-col gap-2.5" role="radiogroup" aria-label={t('Rating')}>
            {LEVELS.map((l) => {
              const on = Math.abs(p.rating - l.rating) < 150;
              return (
                <button
                  key={l.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => p.set({ rating: l.rating })}
                  className={`pressable flex h-14 items-center justify-between rounded-[var(--radius-m)] px-5 text-start text-md font-semibold shadow-card transition-colors ${on ? 'bg-brand-softer ring-2 ring-brand' : 'bg-surface hover:bg-surface-2'}`}
                >
                  <span className="tnum">{t(l.label)}</span>
                  {on && (
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand text-on-brand" aria-hidden>
                      <Check size={15} strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <h2 className="mt-8 text-lg font-bold">{t('I mostly play')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
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
                  className={`pressable h-11 rounded-full px-5 text-base font-semibold ${on ? 'bg-brand text-on-brand' : 'bg-surface text-ink-2 shadow-card hover:text-ink'}`}
                >
                  {speedName(s)}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex gap-2">
            <Button variant="primary" size="lg" onClick={() => setStep(2)}>
              {t('Continue')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="w2">
          <h1 id="w2" className="text-3xl font-bold">
            {t('Pick a starting repertoire')}
          </h1>
          <p className="mt-2 text-md text-ink-2">{t('Short, mainstream lines to grow from. You can change everything later.')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {PACKS.filter((x) => x.starter).map((tpl) => {
              const on = picked.has(tpl.id);
              const first = parseSanLine(mainLineText(tpl.lines[0]!.pgn, 9));
              return (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(tpl.id)) n.delete(tpl.id);
                      else n.add(tpl.id);
                      return n;
                    })
                  }
                  className={`pressable flex gap-3.5 rounded-[var(--radius-l)] p-3.5 text-start shadow-card transition-colors ${on ? 'bg-brand-softer ring-2 ring-brand' : 'bg-surface hover:bg-surface-2'}`}
                >
                  <MiniBoard fen={first.fen} size={72} orientation={tpl.color} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-md font-bold">
                      {t(tpl.name)}
                      {on && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand" aria-hidden>
                          <Check size={13} strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-semibold text-ink-2">
                      {tpl.color === 'white' ? t('White') : t('Black')} · {tpl.color === 'white' ? `1.${tpl.first} ${tpl.reply}` : t('vs {move}', { move: `1.${tpl.first}` })}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">{tpl.lines.map((l) => l.name).join(' · ')}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" loading={busy} disabled={!picked.size} onClick={() => void finish(true)}>
              {t('Start learning')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => void finish(false)}>
              {t('I’ll build my own')}
            </Button>
          </div>
          <p className="mt-6 text-sm text-ink-2">
            {tx('By continuing you agree to the {terms}. See the {privacy} and {cookies}. No ads, no tracking.', {
              terms: (
                <a href={legalUrl('/terms')} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {t('Terms of use')}
                </a>
              ),
              privacy: (
                <a href={legalUrl('/privacy')} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {t('Privacy policy')}
                </a>
              ),
              cookies: (
                <a href={legalUrl('/cookies')} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {t('Cookies')}
                </a>
              ),
            })}
          </p>
          <div className="mt-6 flex justify-center opacity-60">
            <Wordmark height={18} />
          </div>
        </section>
      )}
    </div>
  );
}
