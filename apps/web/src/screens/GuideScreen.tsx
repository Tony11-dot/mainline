import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Compass,
  Cpu,
  Dumbbell,
  GraduationCap,
  Home,
  List,
  NotebookPen,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Swords,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import { FREEZE_EVERY, MAX_FREEZES } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { Button, IconButton } from '../ui/primitives';
import { ListGroup, ListRow, Pill } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { msg, t, tx } from '../lib/i18n';
import { AiArt, BuildArt, ExploreArt, GamesArt, HabitArt, LoopArt, ModesArt, NavArt, OrganiseArt, PanelsArt, ReadyArt, RepertoireArt, SettingsArt, TodayArt, WeakArt } from './guide/art';
import { TryBoard } from './guide/TryBoard';

/** A UI label inside a sentence: the app's own word for it, in bold, so the guide and the screen always match. */
const L = (label: string) => <b className="font-semibold text-ink">{t(label)}</b>;

interface Chapter {
  id: string;
  /** English; shown through t(). */
  title: string;
  art: () => ReactNode;
  body: () => ReactNode;
  /** The real screen this chapter is about. */
  open?: string;
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[60ch] text-lg text-ink-2 text-pretty">{children}</p>;
}

/** The points of a chapter, as a quiet numbered-free list: a dot, then the sentence. */
function Points({ children }: { children: ReactNode[] }) {
  return (
    <ul className="mt-6 flex max-w-[62ch] flex-col gap-3.5">
      {children.map((c, i) => (
        <li key={i} className="flex gap-3 text-md leading-relaxed text-ink-2 text-pretty">
          <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
          <span className="min-w-0">{c}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rows that name a part of the app and what it is for. */
function Rows({ rows }: { rows: { icon: LucideIcon; title: string; sub: ReactNode; tone?: 'brand' | 'good' | 'flame' | 'gem' }[] }) {
  return (
    <ListGroup className="mt-6">
      {rows.map((r) => (
        <ListRow key={r.title} icon={r.icon} tone={r.tone} title={t(r.title)} sub={r.sub} />
      ))}
    </ListGroup>
  );
}

const CHAPTERS: Chapter[] = [
  {
    id: 'welcome',
    title: msg('Welcome to MainLine'),
    art: () => <LoopArt />,
    body: () => (
      <>
        <Lead>{t('MainLine helps you learn your chess openings and remember them for good. This tour shows how everything works, one step at a time. It takes about five minutes, and you can leave whenever you like.')}</Lead>
        <Points>
          {[
            tx('{build}: choose the moves you play and the replies you expect from your opponent.', { build: L('Build') }),
            tx('{train}: the app tests you on each position just before you would forget it.', { train: L('Train') }),
            tx('{check}: import your games and see where your preparation held up and where it broke.', { check: L('Check') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'around',
    title: msg('Getting around'),
    art: () => <NavArt />,
    body: () => (
      <>
        <Lead>{t('The tab bar at the bottom of the screen takes you everywhere. On a tablet or a computer, the same tabs sit in the sidebar.')}</Lead>
        <Rows
          rows={[
            { icon: Home, title: msg('Today'), sub: t('What to practise now, your daily goal and your streak.') },
            { icon: BookOpen, title: msg('Repertoire'), sub: t('Your openings, sorted into folders and lines.') },
            { icon: Compass, title: msg('Explore'), sub: t('Look up any position: how it is played and what the engine thinks.') },
            { icon: Swords, title: msg('Games'), sub: t('Your real games, checked against your preparation.') },
            { icon: Settings, title: msg('Settings'), sub: t('Your level, appearance, reminders and account.') },
            { icon: Sparkles, title: msg('Ask AI'), sub: t('The round button with the sparkle: ask about your openings or the app, from any screen.') },
          ]}
        />
      </>
    ),
  },
  {
    id: 'today',
    title: msg('Today: your daily start'),
    art: () => <TodayArt />,
    open: '/',
    body: () => (
      <>
        <Lead>{t('Open the app, press the big button at the top, and you are practising the right thing.')}</Lead>
        <Points>
          {[
            tx('{train} appears when positions are due for review. {learn} appears when there are new moves to learn. When neither is needed, you are all caught up.', { train: L('Train now'), learn: L('Learn new moves') }),
            tx('The ring fills as you answer, up to your {goal}. {learned} counts the positions you know, and {retention} shows how often you remember them.', { goal: L('Daily goal'), learned: L('Learned'), retention: L('Retention') }),
            tx('Further down are more ways to practise and the tools: {weak}, {plan}, {stats} and the {board}.', { weak: L('Weak spots'), plan: L('Study plan'), stats: L('Statistics'), board: L('Analysis board') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'repertoire',
    title: msg('Your repertoire'),
    art: () => <RepertoireArt />,
    open: '/library',
    body: () => (
      <>
        <Lead>{t('Your repertoire is every move you have decided to play. The Repertoire tab keeps White and Black apart, and sorts each side into folders: first moves, then openings, then their lines.')}</Lead>
        <Points>
          {[
            t('A line is one path through an opening: your moves, and the replies you expect from your opponent. One opening usually has several lines.'),
            tx('The quickest start is {ready}: each set is a few named lines you can practise straight away.', { ready: L('Ready-made openings') }),
            tx('Prefer to make your own? Choose {line} in the {new} menu and play the moves on the board. Already have a PGN file? {import} in the same menu brings it in, and its comments become notes.', { line: L('New line'), new: L('New'), import: L('Import PGN') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'organise',
    title: msg('Folders and lines'),
    art: () => <OrganiseArt />,
    open: '/library',
    body: () => (
      <>
        <Lead>{t('The Repertoire tab works like the files on a computer: open a folder to go inside, and use the path at the top to go back.')}</Lead>
        <Points>
          {[
            t('Touch and hold a folder or a line (or right-click it on a computer) to see what you can do with it: rename it, move it, export it as PGN or delete it.'),
            tx('Tap {select} to move or delete several at once. On a computer you can also drag items onto a folder.', { select: L('Select') }),
            tx('Deleted something by mistake? Tap {undo} in the message that appears.', { undo: L('Undo') }),
            tx('Every folder and line has {show} and {test}, so you can practise exactly that part.', { show: L('Show me'), test: L('Test me') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'build',
    title: msg('Building a line'),
    art: () => <BuildArt />,
    open: '/library',
    body: () => (
      <>
        <Lead>{t('Open a line and play moves on the board: your move, the reply you expect, your next move, and so on. Everything is saved as you go.')}</Lead>
        <Points>
          {[
            tx('In {guided} mode an arrow shows the top pick. Play it, play any other move, or tap a suggestion in the list.', { guided: L('Guided') }),
            tx('Tags explain each suggestion: {book} is what masters play most, {engine} is the engine’s best move, and {club} scores best at your rating.', { book: L('By the book'), engine: L('Engine’s pick'), club: L('Club crusher') }),
            tx('{suggest} ranks your options. {replies} adds the replies you are most likely to meet, so your line is ready for them.', { suggest: L('Suggest my move'), replies: L('Add popular replies') }),
            t('Play a different move where your line already has one, and MainLine asks whether to make it a new line or keep it as an alternate.'),
            tx('Ready-made lines are locked so you can study them as they are. {edit} makes one yours to change.', { edit: L('Edit this line') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'panels',
    title: msg('Tools under the board'),
    art: () => <PanelsArt />,
    body: () => (
      <>
        <Lead>{t('Every line comes with panels that explain the position. Switch between them with the tabs under the board, or beside it on a wide screen.')}</Lead>
        <Rows
          rows={[
            { icon: List, title: msg('Moves'), sub: t('The whole line. Tap a move to jump to it.') },
            { icon: BarChart3, title: msg('Explorer'), sub: t('How often masters and players at your rating choose each move, and how it scores. Sign in with Lichess (free) to load it.') },
            { icon: Cpu, title: msg('Engine'), sub: t('Stockfish’s evaluation and its best lines.') },
            { icon: Sparkles, title: msg('Coach'), sub: t('A plain-language explanation built only from the engine and game statistics, so it doesn’t invent moves.') },
            { icon: NotebookPen, title: msg('Notes'), sub: t('Why you play a move, plus arrows you draw on the board. Notes show up while you train.') },
            { icon: Waypoints, title: msg('Coverage'), sub: t('Popular replies you haven’t prepared yet, and common mistakes by your opponents that you should know how to punish.') },
          ]}
        />
      </>
    ),
  },
  {
    id: 'train',
    title: msg('How training works'),
    art: () => <TryBoard />,
    body: () => (
      <>
        <Lead>{t('Training shows a position from your repertoire and asks for your move. Try it on this board.')}</Lead>
        <Points>
          {[
            t('A new move is shown with an arrow first. After that, you play it from memory.'),
            t('A wrong move shows you the right one, and that position comes back sooner.'),
            tx('Stuck? {show} reveals the answer, and {skip} moves on to the next line. The cross at the top ends the session.', { show: L('Show move'), skip: L('Skip line') }),
            tx('At the end you see your accuracy and the positions to look at again. {why} explains each one.', { why: L('Why?') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'modes',
    title: msg('Four ways to practise'),
    art: () => <ModesArt />,
    open: '/',
    body: () => (
      <>
        <Lead>{t('All four start from Today. Pick the one that fits your time and mood.')}</Lead>
        <Rows
          rows={[
            { icon: GraduationCap, title: msg('Learn'), sub: t('Brings in new moves from your lines, a few each day. Choose how many in Settings.') },
            { icon: RotateCcw, title: msg('Review'), sub: tx('Spaced repetition: each position returns just before you would forget it. {train} on Today starts it.', { train: L('Train now') }) },
            { icon: Shuffle, title: msg('Drill'), sub: t('Whole lines from memory. Your opponent’s replies come as often as real players choose them.') },
            { icon: Dumbbell, title: msg('Position quiz'), sub: t('Single positions, the weakest first.') },
          ]}
        />
        <Points>{[tx('On any folder or line, {show} walks you through every move, and {test} checks you from memory.', { show: L('Show me'), test: L('Test me') })]}</Points>
      </>
    ),
  },
  {
    id: 'habit',
    title: msg('Goal, streak and reminders'),
    art: () => <HabitArt />,
    open: '/settings',
    body: () => (
      <>
        <Lead>{t('A few minutes every day works better than one long session a week.')}</Lead>
        <Points>
          {[
            tx('Every answer counts towards your {goal}. It starts at {n} a day, and you can change it in Settings.', { goal: L('Daily goal'), n: 20 }),
            tx('Practise on consecutive days to build a streak. Every {days} days in a row earns a streak freeze (you can hold {max}), and a missed day uses one automatically.', { days: FREEZE_EVERY, max: MAX_FREEZES }),
            tx('Turn on {reminders} in Settings for a nudge at a time you choose. They stop once you have practised that day.', { reminders: L('Streak reminders') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'games',
    title: msg('Check your real games'),
    art: () => <GamesArt />,
    open: '/games',
    body: () => (
      <>
        <Lead>{t('In the Games tab, enter your Lichess or Chess.com username and import. MainLine only looks at the openings.')}</Lead>
        <Points>
          {[
            tx('{breaks} shows where each game left your preparation: {surprises} (your opponent played a move you hadn’t prepared, and you can add your answer right there), {forgotten} (you played something other than the move you learned, so that position becomes due again) and {ended} (the game outlasted your line).', {
              breaks: L('Where your prep breaks'),
              surprises: <Pill tone="warn">{t('Surprises')}</Pill>,
              forgotten: <Pill tone="bad">{t('Forgotten')}</Pill>,
              ended: <Pill tone="good">{t('Prep ended')}</Pill>,
            }),
            t('After the first import, new games are checked automatically.'),
            tx('{opp}: type in your next opponent’s username to see what they usually play and where it meets your repertoire.', { opp: L('Opponent prep') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'weak',
    title: msg('Weak spots and study plans'),
    art: () => <WeakArt />,
    open: '/focus',
    body: () => (
      <>
        <Lead>{t('MainLine notices where you go wrong most, from your training answers and your imported games.')}</Lead>
        <Points>
          {[
            tx('{weak} lists your weakest moves, openings and lines, each with {show} and {test}. You’ll find it on Today.', { weak: L('Weak spots'), show: L('Show me'), test: L('Test me') }),
            tx('A {plan} spreads the work over a few days: pick what to work on, for how many days and how many minutes a day.', { plan: L('Study plan') }),
            t('Each plan shows you the moves first, then tests the weakest parts, then ends with an exam. Today shows the session for the day.'),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'explore',
    title: msg('Look things up'),
    art: () => <ExploreArt />,
    open: '/explore',
    body: () => (
      <>
        <Lead>{t('Explore is for curiosity: play moves on the board and see how the position is played, without touching your repertoire.')}</Lead>
        <Points>
          {[
            t('The explorer shows how often each move is played by masters and at your rating, and how it scores. The engine gives its verdict too.'),
            tx('{openings} in the Repertoire tab’s {new} menu searches every named opening, by name or ECO code.', { openings: L('Browse openings by name'), new: L('New') }),
            tx('The {board} (on Today) sets up any position or takes a pasted FEN, then analyses it with Stockfish.', { board: L('Analysis board') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'ai',
    title: msg('Ask AI'),
    art: () => <AiArt />,
    body: () => (
      <>
        <Lead>{t('The sparkle button opens a chat that knows your folders and lines, your rating and the screen you are on.')}</Lead>
        <Points>
          {[
            t('Ask in your own words: why a move is played, what to study next, how to meet an opening you keep losing to.'),
            tx('Tell it about yourself under {about}: your style, your goals, how much time you have. It reads this with every question.', { about: L('About me') }),
            t('The AI can be wrong. For hard facts, trust the explorer and the engine. Questions have a daily limit.'),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'settings',
    title: msg('Make it yours'),
    art: () => <SettingsArt />,
    open: '/settings',
    body: () => (
      <>
        <Lead>{t('Settings is where you tell MainLine about yourself and change how it looks.')}</Lead>
        <Points>
          {[
            tx('{level}: your rating and the time controls you play. Statistics and suggestions use players around your rating. This is also where you set new moves per day and the daily goal.', { level: L('Your level') }),
            t('Themes, boards, piece sets and fonts, plus sound, vibration and language: pick what you like.'),
            tx('{account} is optional. Sign in with Lichess, Chess.com or Apple to keep your repertoire and training in step across devices. Without an account, everything stays on this device and works offline.', { account: L('Account') }),
          ]}
        </Points>
      </>
    ),
  },
  {
    id: 'ready',
    title: msg('You’re ready'),
    art: () => <ReadyArt />,
    body: () => (
      <>
        <Lead>{t('The short version: build a few lines, press the big button on Today every day, and import your games now and then.')}</Lead>
        <Points>{[tx('You can take this tour again any time: it’s under {tools} on Today, and in Settings.', { tools: L('Tools') })]}</Points>
      </>
    ),
  },
];

const clamp = (i: number) => Math.max(0, Math.min(CHAPTERS.length - 1, i));

/** The full tour of the app: one chapter per screen, with a picture of it, what it's for, and how to use it. */
export function GuideScreen() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  // Where the first run goes when the tour ends (set by Welcome); otherwise, back to where it was opened.
  const next = params.get('next');
  const p = usePrefs();
  const [at, setAt] = useState(() => clamp(next ? 0 : p.guideAt));
  const [dir, setDir] = useState(1);
  const [contents, setContents] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const rtl = document.documentElement.dir === 'rtl';
  const ch = CHAPTERS[at]!;
  const last = at === CHAPTERS.length - 1;

  useEffect(() => {
    p.set({ guideAt: at });
    if (first.current) {
      first.current = false;
      return;
    }
    // A new chapter: screen readers start at its title, and the page starts at the top.
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => {
    const n = clamp(i);
    if (n === at) return;
    setDir(n > at ? 1 : -1);
    setAt(n);
  };
  // Skipping ends the tour (Today stops offering it); a peek at the real screen keeps it open on this chapter.
  const leave = (to?: string) => {
    p.set(to ? { guideAt: at } : { guideSeen: true, guideAt: last ? 0 : at });
    if (to) nav(to);
    else if (next) nav(next, { replace: true });
    else if (loc.key !== 'default') nav(-1);
    else nav('/', { replace: true });
  };
  const finish = () => {
    p.set({ guideSeen: true, guideAt: 0 });
    if (next) nav(next, { replace: true });
    else nav('/', { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (contents || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable]')) return;
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) go(at + 1);
      if (e.key === back) go(at - 1);
      if (e.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe between chapters, except on the practice board, where a drag is a move.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('.ml-board')) return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(e.clientY - s.y) * 1.5) return;
    go(at + ((dx < 0) !== rtl ? 1 : -1));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col md:min-h-0 md:py-6">
      <header className="sticky top-0 z-[var(--z-sticky)] flex items-center gap-2 bg-bg/90 px-3 py-2 backdrop-blur-md md:static md:bg-transparent md:px-8 md:backdrop-blur-none">
        <IconButton icon={X} label={t('Skip tour')} onClick={() => leave()} />
        <div className="flex min-w-0 flex-1 gap-1" role="progressbar" aria-label={t('How MainLine works')} aria-valuemin={1} aria-valuemax={CHAPTERS.length} aria-valuenow={at + 1} aria-valuetext={t('Step {n} of {total}', { n: at + 1, total: CHAPTERS.length })}>
          {CHAPTERS.map((c, i) => (
            <span key={c.id} className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-[var(--dur-slow)] ${i <= at ? 'bg-brand' : 'bg-surface-3'}`} />
          ))}
        </div>
        <span className="tnum min-w-12 text-center text-sm font-bold text-ink-2" aria-hidden>
          {at + 1}/{CHAPTERS.length}
        </span>
        <IconButton icon={List} label={t('Contents')} onClick={() => setContents(true)} />
      </header>

      <div
        key={ch.id}
        className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-8 md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 lg:pt-10"
        style={{ animation: 'ml-guide-in var(--dur-slow) var(--ease-out-expo)', ['--guide-from' as string]: dir * (rtl ? -1 : 1) }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <figure className="flex min-h-[260px] items-center justify-center rounded-[var(--radius-xl)] bg-brand-softer px-4 py-8 ring-1 ring-line lg:min-h-[440px] lg:px-8">{ch.art()}</figure>
        <section aria-labelledby="guide-title" className="min-w-0">
          <p className="text-sm font-bold text-brand-ink">{t('Step {n} of {total}', { n: at + 1, total: CHAPTERS.length })}</p>
          <h1 id="guide-title" ref={heading} tabIndex={-1} className="mt-1 text-3xl font-bold tracking-tight text-balance outline-none md:text-4xl">
            {t(ch.title)}
          </h1>
          {ch.body()}
          {ch.open && (
            <button type="button" onClick={() => leave(ch.open)} className="pressable mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-1 font-semibold text-brand-ink underline-offset-4 hover:underline">
              {t('Open it in the app')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden />
            </button>
          )}
        </section>
      </div>

      <footer className="sticky bottom-0 z-[var(--z-sticky)] flex gap-2.5 lg:justify-end bg-bg/90 px-4 pt-3 backdrop-blur-md md:static md:bg-transparent md:px-8 md:backdrop-blur-none" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <Button size="lg" variant="secondary" icon={ArrowLeft} className="[&_svg]:rtl:rotate-180" disabled={at === 0} onClick={() => go(at - 1)} aria-label={t('Back')}>
          <span className="hidden sm:inline">{t('Back')}</span>
        </Button>
        {last ? (
          <Button size="lg" variant="primary" className="flex-1 lg:max-w-[320px] lg:flex-none lg:basis-[320px]" onClick={finish}>
            {next ? t('Start learning') : t('Done')} <Check size={18} aria-hidden />
          </Button>
        ) : (
          <Button size="lg" variant="primary" className="flex-1 lg:max-w-[320px] lg:flex-none lg:basis-[320px]" onClick={() => go(at + 1)}>
            {t('Next')} <ArrowRight size={18} className="rtl:rotate-180" aria-hidden />
          </Button>
        )}
      </footer>

      <Sheet open={contents} onClose={() => setContents(false)} title={t('Contents')}>
        <ol className="flex flex-col gap-1 pb-2">
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                aria-current={i === at ? 'step' : undefined}
                onClick={() => {
                  setContents(false);
                  go(i);
                }}
                className={`pressable flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-m)] px-3 text-start ${i === at ? 'bg-brand-soft text-brand-ink' : 'hover:bg-surface-2'}`}
              >
                <span className={`tnum flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i < at ? 'bg-brand text-on-brand' : i === at ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2'}`} aria-hidden>
                  {i < at ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-md font-semibold break-words">{t(c.title)}</span>
              </button>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
