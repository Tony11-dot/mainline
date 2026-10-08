import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, Trash2, UserRound } from 'lucide-react';
import { INITIAL_FEN } from '@mainline/shared';
import { useAssistant } from '../lib/assistant';
import { usePrefs } from '../lib/prefs';
import { CoachText } from '../panels/CoachText';
import { Sheet } from './Sheet';
import { Button, Spinner } from './primitives';
import { msg, t } from '../lib/i18n';

const STARTERS = [msg('Which line should I add next?'), msg('Where do my lines differ from each other?'), msg('Explain the line I’m on'), msg('What are the weak spots in my repertoire?')];

/** The AI chat: ask anything; it knows your folders and lines, your settings, and what you've told it about yourself. */
export function AssistantSheet() {
  const { open, turns, busy, setOpen, ask, clear } = useAssistant();
  const notes = usePrefs((s) => s.aiNotes);
  const [text, setText] = useState('');
  const [aboutMe, setAboutMe] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, busy]);

  const send = (q = text) => {
    if (!q.trim() || busy) return;
    setText('');
    void ask(q);
  };

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={t('Ask AI')}
      wide
      footer={
        <form
          className="flex w-full items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={t('Ask anything…')}
            aria-label={t('Your question')}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-base outline-none placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/20"
          />
          <Button type="submit" variant="primary" icon={ArrowUp} disabled={busy || !text.trim()} aria-label={t('Send')}>
            {t('Send')}
          </Button>
        </form>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAboutMe((v) => !v)} aria-expanded={aboutMe} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-sm font-semibold text-ink-2 hover:text-ink">
            <UserRound size={14} aria-hidden /> {notes.trim() ? t('About me ✓') : t('About me')}
          </button>
          {turns.length > 0 && (
            <button type="button" onClick={clear} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink">
              <Trash2 size={14} aria-hidden /> {t('New chat')}
            </button>
          )}
        </div>
        {aboutMe && (
          <label className="block">
            <span className="mb-1 block text-xs text-ink-3">{t('The AI reads this with every question: your style, your goals, what to avoid.')}</span>
            <textarea
              value={notes}
              onChange={(e) => usePrefs.getState().set({ aiNotes: e.target.value.slice(0, 1500) })}
              rows={3}
              placeholder={t('e.g. I like quiet positional lines, I hate theory-heavy gambits, I have little time to study.')}
              className="w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand"
            />
          </label>
        )}
        {turns.length === 0 ? (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-sm text-ink-2">{t('It knows your folders and lines, your rating and what you’re looking at.')}</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => send(t(s))} className="rounded-full border border-line px-3 py-1.5 text-start text-sm font-medium hover:bg-surface-2">
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-3" aria-label={t('Conversation')} aria-live="polite">
            {turns.map((m, i) => (
              <li key={i} className={m.role === 'user' ? 'ms-10 self-end rounded-[16px] rounded-ee-[6px] bg-brand px-3.5 py-2 text-on-brand' : 'me-6 rounded-[16px] rounded-es-[6px] bg-surface-2 px-3.5 py-2.5'}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.text}</p> : <CoachText text={m.text} fen={INITIAL_FEN} />}
              </li>
            ))}
            {busy && (
              <li className="me-6 inline-flex items-center gap-2 self-start rounded-[16px] bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
                <Spinner size={14} /> {t('Thinking…')}
              </li>
            )}
          </ol>
        )}
        <div ref={end} />
      </div>
    </Sheet>
  );
}

/** Ask AI on phones: a round glass button docked beside the tab bar (the sidebar has its own). */
export function AssistantTabButton() {
  const setOpen = useAssistant((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('Ask AI')}
      className="glass flex aspect-square h-full shrink-0 items-center justify-center rounded-full text-brand active:scale-95"
    >
      <Sparkles size={22} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function AssistantNavButton() {
  const setOpen = useAssistant((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-2 flex h-14 flex-col items-center justify-center gap-1 rounded-[12px] text-[11px] font-semibold text-brand-ink transition-colors hover:bg-brand-soft lg:h-10 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-[10px] lg:px-3 lg:text-base lg:font-medium"
    >
      <Sparkles size={19} strokeWidth={2} aria-hidden />
      {t('Ask AI')}
    </button>
  );
}

