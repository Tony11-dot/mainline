import { useEffect, useState } from 'react';
import { BookOpenText, MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { CoachKind } from '@mainline/shared';
import { askCoach, type CoachReply } from '../lib/coach';
import { ApiError } from '../lib/api';
import { Button, PanelNote, Skeleton, Spinner } from '../ui/primitives';
import { CoachText } from './CoachText';

type Req = { kind: CoachKind; fen: string; moveUci?: string; playedUci?: string; lineUcis?: string[] };

/** One explanation (loads on mount). */
export function CoachAnswer({ req, onMove, onHover }: { req: Req; onMove?: (uci: string) => void; onHover?: (uci: string | null) => void }) {
  const [state, setState] = useState<{ reply?: CoachReply; error?: string; loading: boolean }>({ loading: true });
  const key = JSON.stringify(req);
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    askCoach(req)
      .then((reply) => live && setState({ reply, loading: false }))
      .catch((e) => live && setState({ error: e instanceof ApiError ? e.message : 'The coach is unavailable right now.', loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (state.loading)
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  if (state.error || !state.reply) return <p className="text-sm text-ink-2">{state.error}</p>;
  const r = state.reply;
  return (
    <div>
      <CoachText text={r.text} fen={req.fen} onMove={onMove} onHover={onHover} />
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
        {r.source === 'template' ? (
          <>
            <BookOpenText size={13} aria-hidden /> From the engine and game statistics{r.resting ? ' · the AI coach is resting until tomorrow' : ''}
          </>
        ) : (
          <>
            <Sparkles size={13} aria-hidden /> AI coach · grounded in this position’s engine lines and stats
          </>
        )}
      </p>
    </div>
  );
}

/** Builder "Coach" pane: why this move, the story of the line, and free questions. */
export function CoachPanel({ fen, parentFen, moveUci, lineUcis, lineStartFen, onMove, onHover }: { fen: string; parentFen?: string; moveUci?: string; lineUcis: string[]; lineStartFen: string; onMove?: (uci: string) => void; onHover?: (uci: string | null) => void }) {
  const [tab, setTab] = useState<'why' | 'story' | 'ask'>(moveUci ? 'why' : 'ask');
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState<{ q: string; reply?: CoachReply; loading: boolean; error?: string }[]>([]);
  useEffect(() => setAsked([]), [fen]);
  const ask = async () => {
    const question = q.trim();
    if (!question) return;
    setQ('');
    const i = asked.length;
    setAsked((a) => [...a, { q: question, loading: true }]);
    try {
      const reply = await askCoach({ kind: 'position', fen, question });
      setAsked((a) => a.map((x, j) => (j === i ? { ...x, reply, loading: false } : x)));
    } catch (e) {
      setAsked((a) => a.map((x, j) => (j === i ? { ...x, loading: false, error: (e as Error).message } : x)));
    }
  };
  return (
    <div className="p-3.5">
      <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Coach">
        {(
          [
            ['why', 'Why this move?'],
            ['story', 'Line story'],
            ['ask', 'Ask'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            onClick={() => setTab(id)}
            disabled={id === 'why' && !moveUci}
            className={`h-8 rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${tab === id ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2 hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'why' && moveUci && parentFen && <CoachAnswer req={{ kind: 'move', fen: parentFen, moveUci }} onMove={onMove} onHover={onHover} />}
      {tab === 'story' &&
        (lineUcis.length ? <CoachAnswer req={{ kind: 'line', fen: lineStartFen, lineUcis }} /> : <PanelNote title="Step into a line first">The story covers the moves from the start to here.</PanelNote>)}
      {tab === 'ask' && (
        <div className="flex flex-col gap-3">
          {asked.map((a, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <p className="self-end rounded-[14px] rounded-br-[4px] bg-brand px-3 py-2 text-sm text-on-brand">{a.q}</p>
              <div className="rounded-[14px] rounded-bl-[4px] bg-surface-2 px-3 py-2.5">
                {a.loading ? <Spinner /> : a.error ? <p className="text-sm text-bad">{a.error}</p> : a.reply ? <CoachText text={a.reply.text} fen={fen} onMove={onMove} onHover={onHover} /> : null}
              </div>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this position…" maxLength={400} className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-3 text-base outline-none focus:border-brand focus:ring-3 focus:ring-brand/20" aria-label="Ask the coach" />
            <Button variant="primary" icon={MessageCircleQuestion} type="submit" disabled={!q.trim()}>
              Ask
            </Button>
          </form>
          <p className="text-xs text-ink-3">The coach only uses this position’s engine lines and game statistics — it won’t invent moves.</p>
        </div>
      )}
    </div>
  );
}
