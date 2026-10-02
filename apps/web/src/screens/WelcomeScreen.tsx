import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { SPEEDS, type Speed } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { useLibrary } from '../lib/library';
import { TEMPLATES } from '../lib/templates';
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
  const [picked, setPicked] = useState<Set<string>>(new Set(['italian', 'caro']));
  const [busy, setBusy] = useState(false);

  const finish = async (withTemplates: boolean) => {
    setBusy(true);
    await lib.load();
    if (withTemplates) {
      for (const tpl of TEMPLATES.filter((x) => picked.has(x.id))) {
        const root = lib.folders.find((f) => !f.deleted && f.parentId === null && f.color === tpl.color) ?? useLibrary.getState().folders.find((f) => !f.deleted && f.parentId === null && f.color === tpl.color);
        const rep = await useLibrary.getState().createRepertoire({ name: t(tpl.name), color: tpl.color, folderId: root?.id ?? null });
        await useLibrary.getState().importPgn(rep.id, tpl.pgn);
      }
    }
    p.set({ onboarded: true });
    nav(withTemplates && picked.size ? '/train?mode=learn' : '/library', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col justify-center px-5 py-10">
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-surface-3'}`} />
        ))}
      </div>

      {step === 0 && (
        <section aria-labelledby="w0">
          <LogoMark size={64} />
          <h1 id="w0" className="mt-5 text-3xl font-bold tracking-tight">
            {t('Master your openings, branch by branch.')}
          </h1>
          <p className="mt-3 max-w-[46ch] text-md text-ink-2">
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
          <h1 id="w1" className="text-2xl font-bold">
            {t('What’s your level?')}
          </h1>
          <p className="mt-1 text-ink-2">{t('Statistics and suggestions use players around your rating.')}</p>
          <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label={t('Rating')}>
            {LEVELS.map((l) => {
              const on = Math.abs(p.rating - l.rating) < 150;
              return (
                <button
                  key={l.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => p.set({ rating: l.rating })}
                  className={`flex h-14 items-center justify-between rounded-[14px] border px-4 text-start text-base font-semibold transition-colors ${on ? 'border-brand bg-brand-softer' : 'border-line bg-surface hover:bg-surface-2'}`}
                >
                  {t(l.label)}
                  {on && <Check size={20} className="text-brand" aria-hidden />}
                </button>
              );
            })}
          </div>
          <h2 className="mt-6 text-sm font-semibold text-ink-2">{t('I mostly play')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
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
                  className={`h-10 rounded-full px-4 text-sm font-semibold ${on ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2'}`}
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
          <h1 id="w2" className="text-2xl font-bold">
            {t('Pick a starting repertoire')}
          </h1>
          <p className="mt-1 text-ink-2">{t('Short, mainstream lines to grow from. You can change everything later.')}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((tpl) => {
              const on = picked.has(tpl.id);
              const first = parseSanLine(tpl.pgn.replace(/\([^)]*\)/g, '').replace(/\*/, '').split(/\s+/).slice(0, 9).join(' '));
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
                  className={`flex gap-3 rounded-[16px] border p-3 text-start transition-colors ${on ? 'border-brand bg-brand-softer' : 'border-line bg-surface hover:bg-surface-2'}`}
                >
                  <MiniBoard fen={first.fen} size={72} orientation={tpl.color} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-bold">
                      {t(tpl.name)}
                      {on && <Check size={16} className="text-brand" aria-hidden />}
                    </span>
                    <span className="block text-xs font-semibold text-ink-3">
                      {tpl.color === 'white' ? t('White') : t('Black')} · {tpl.color === 'white' ? tpl.vs : t('vs {move}', { move: tpl.vs })}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">{t(tpl.blurb)}</span>
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
          <p className="mt-6 text-xs text-ink-3">
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
