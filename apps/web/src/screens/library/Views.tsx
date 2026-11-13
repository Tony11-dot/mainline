import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, BookMarked, CalendarDays, ChevronRight, FolderPlus, ListPlus, Plus, Settings2, Sparkles, Swords, Target, TriangleAlert } from 'lucide-react';
import { type Folder } from '@mainline/shared';
import { folderMoves, repsUnder, useLibrary } from '../../lib/library';
import { useGames } from '../../lib/games';
import { PACKS, recordFor, weakSpots } from '../../lib/packs';
import { type Scope } from '../../lib/practice';
import { Button, IconButton, PanelNote } from '../../ui/primitives';
import { CARD, CARD_DASHED, Card } from '../../ui/kit';
import { PracticeButtons, ProgressText, RecordBadge, scopeProgress } from './practiceUi';
import { WeakSpotCard } from './WeakSpotCard';
import { t, tn } from '../../lib/i18n';
import { folderLevel, type FinderCtx, type Item, type SheetState } from './finderModel';
import { ColorDot, FinderList, useDrop } from './Finder';

/* ---------------- Views ---------------- */

export function RootView({ roots, finder, itemsIn, conflicts, setSheet, toolbarNew, planHref }: { roots: Folder[]; finder: FinderCtx; itemsIn: (id: string) => Item[]; conflicts: number; setSheet: (s: SheetState) => void; toolbarNew: React.ReactNode; planHref: (s: Scope, label: string) => string }) {
  const games = useGames((g) => g.games);
  const loaded = useLibrary((s) => s.loaded);
  const spot = useMemo(() => weakSpots(games)[0], [games]);
  const all = useMemo(() => scopeProgress(finder.reps, finder.moves, finder.cards), [finder.reps, finder.moves, finder.cards]);
  const single = roots.length === 1;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 text-3xl font-bold md:text-4xl">{single ? (roots[0]!.color === 'white' ? t('As White') : t('As Black')) : t('Repertoire')}</h1>
        <div className="ms-auto flex items-center gap-1">
          {!finder.wide && (
            <>
              <Link to="/focus" aria-label={t('Weak spots')} className="pressable inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink">
                <Target size={19} aria-hidden />
              </Link>
              <Link to="/plan" aria-label={t('Study plan')} className="pressable inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink">
                <CalendarDays size={19} aria-hidden />
              </Link>
            </>
          )}
          {toolbarNew}
        </div>
      </div>

      {!single && (spot ? (
        <div className="mt-5">
          <WeakSpotCard spot={spot} />
        </div>
      ) : games.length === 0 && loaded ? (
        <Link to="/games" className={`pressable mt-5 flex items-center gap-3.5 px-5 py-4 text-base text-ink-2 hover:bg-surface-2 ${CARD_DASHED}`}>
          <Swords size={20} className="shrink-0 text-brand" aria-hidden />
          <span className="flex-1">{t('Import your games and MainLine finds the openings you lose most — then hands you ready-made lines for them.')}</span>
          <ChevronRight size={18} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
        </Link>
      ) : null)}

      {conflicts > 0 && (
        <button type="button" onClick={() => setSheet({ kind: 'conflicts' })} className="pressable mt-5 flex w-full items-center gap-3.5 rounded-[var(--radius-m)] bg-warn-soft px-5 py-4 text-start text-warn-ink">
          <TriangleAlert size={20} className="shrink-0" aria-hidden />
          <span className="flex-1 text-base font-medium">
            {tn(conflicts, '{n} position where your repertoires disagree on your move.', '{n} positions where your repertoires disagree on your move.')} {t('Training uses one move per position.')}
          </span>
          <ChevronRight size={18} className="text-ink-3 rtl:rotate-180" aria-hidden />
        </button>
      )}

      {loaded && finder.reps.length === 0 && !single && (
        <div className={`mt-6 ${CARD_DASHED}`}>
          <PanelNote
            icon={BookMarked}
            title={t('Build your first repertoire')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/library/ready" className="pressable inline-flex min-h-11 py-1 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-on-brand">
                  <Sparkles size={18} aria-hidden /> {t('Ready-made openings')}
                </Link>
                <Button onClick={() => setSheet({ kind: 'pick', color: 'white' })}>{t('Build my own')}</Button>
              </div>
            }
          >
            {t('Start from ready-made lines to practise straight away, or build your own move by move with suggestions.')}
          </PanelNote>
        </div>
      )}

      {finder.reps.length > 0 && !single && (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{t('Everything')}</h2>
            <p className="tnum text-base text-ink-2">
              <ProgressText p={all} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PracticeButtons scope={{ kind: 'all' }} />
            <Link to={planHref({ kind: 'all' }, t('Everything'))} className="pressable inline-flex min-h-11 py-1 items-center gap-2 rounded-[var(--radius-control)] px-3 font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
              <CalendarDays size={17} aria-hidden /> {t('Plan')}
            </Link>
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {roots.map((root) => (
          <ColorSection key={root.id} root={root} finder={finder} items={itemsIn(root.id)} setSheet={setSheet} single={single} planHref={planHref} />
        ))}
      </div>
    </>
  );
}

export function ColorSection({ root, finder, items, setSheet, single, planHref }: { root: Folder; finder: FinderCtx; items: Item[]; setSheet: (s: SheetState) => void; single: boolean; planHref: (s: Scope, label: string) => string }) {
  const inside = useMemo(() => finder.reps.filter((r) => r.color === root.color), [finder.reps, root.color]);
  const progress = useMemo(() => scopeProgress(inside, finder.moves, finder.cards), [inside, finder.moves, finder.cards]);
  const { over, props } = useDrop(root.id, finder.drop);
  const label = root.color === 'white' ? t('As White') : t('As Black');
  return (
    <section aria-label={label} {...props} className={over ? 'rounded-[var(--radius-l)] ring-2 ring-brand' : ''}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          {!single && (
            <h2 className="flex items-center gap-2.5 text-xl font-bold">
              <ColorDot color={root.color} />
              {label}
            </h2>
          )}
          <p className="tnum text-base text-ink-2">
            <ProgressText p={progress} />
          </p>
        </div>
        {inside.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <PracticeButtons scope={{ kind: 'color', color: root.color }} size="sm" />
            <Link to={planHref({ kind: 'color', color: root.color }, label)} aria-label={t('Plan')} className="pressable inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-surface-3 hover:text-ink">
              <CalendarDays size={16} aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <FinderList items={items} finder={finder} label={label} />
      <button type="button" onClick={() => setSheet({ kind: 'pick', color: root.color })} className={`pressable mt-3 flex min-h-[56px] w-full items-center gap-2.5 px-5 text-start text-md font-semibold text-brand-ink hover:bg-surface-2 ${CARD_DASHED}`}>
        <Plus size={18} aria-hidden /> {root.color === 'white' ? t('Add a first move') : t('Add a first move to answer')}
      </button>
    </section>
  );
}

export function FolderView({ folder, finder, items, setSheet, newFolder, planHref, parentHref, wide, toolbarNew }: { folder: Folder; finder: FinderCtx; items: Item[]; setSheet: (s: SheetState) => void; newFolder: (parent?: Folder) => void; planHref: (s: Scope, label: string) => string; parentHref: string; wide: boolean; toolbarNew: React.ReactNode }) {
  const nav = useNavigate();
  const lib = useLibrary();
  const inside = useMemo(() => repsUnder(finder.folders, finder.reps, folder.id), [finder.folders, finder.reps, folder.id]);
  const progress = useMemo(() => scopeProgress(inside, finder.moves, finder.cards), [inside, finder.moves, finder.cards]);
  const at = folderMoves(finder.folders, finder.reps, folder.id);
  const { first, reply } = folderLevel(at);
  const isFirst = !!(first && at.length === 1);
  const rec = first && reply && at.length === 2 ? recordFor(finder.records, folder.color, first, reply) : undefined;
  const packs = first && reply ? PACKS.filter((p) => p.color === folder.color && p.first === first && p.reply === reply) : [];
  const [renaming, setRenaming] = useState(false);
  const { over, props } = useDrop(folder.id, finder.drop);

  const buildOwn = async () => {
    const n = finder.reps.filter((r) => r.folderId === folder.id).length + 1;
    const rep = await lib.createRepertoire({ name: t('Line {n}', { n }), color: folder.color, folderId: folder.id, rootMovesUci: at });
    nav(`/rep/${rep.id}?guide=1`);
  };

  return (
    <div {...props} className={over ? 'rounded-[var(--radius-l)] ring-2 ring-brand ring-offset-8 ring-offset-bg' : ''}>
      <div className="flex items-start gap-2">
        {!wide && (
          <Link to={parentHref} className="pressable -ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back')}>
            <ArrowLeft size={20} className="rtl:rotate-180" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {!wide && <MobileTrail folder={folder} folders={finder.folders} />}
          {renaming ? (
            <input
              autoFocus
              defaultValue={t(folder.name)}
              aria-label={t('Rename')}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                if (e.currentTarget.value.trim()) void lib.renameFolder(folder.id, e.currentTarget.value);
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="w-full rounded-[var(--radius-xs)] border border-brand bg-surface px-2 py-0.5 text-3xl font-bold outline-none"
            />
          ) : (
            <h1 className="text-3xl font-bold" onDoubleClick={() => setRenaming(true)}>
              {t(folder.name)}
            </h1>
          )}
          <p className="tnum mt-1 flex flex-wrap items-center gap-2 text-base text-ink-2">
            <ProgressText p={progress} />
            <RecordBadge rec={rec} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon={Settings2} label={t('Folder settings')} size={44} onClick={() => setSheet({ kind: 'folder-settings', id: folder.id })} />
          {toolbarNew}
        </div>
      </div>
      {inside.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <PracticeButtons scope={{ kind: 'folder', id: folder.id }} />
          <Link to={planHref({ kind: 'folder', id: folder.id }, t(folder.name))} className="pressable inline-flex min-h-11 py-1 items-center gap-2 rounded-[var(--radius-control)] px-3 font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <CalendarDays size={17} aria-hidden /> {t('Make a plan')}
          </Link>
        </div>
      )}

      <div className="mt-6">
        <FinderList
          items={items}
          finder={finder}
          label={t(folder.name)}
          empty={<p className={`px-4 py-6 text-center text-sm text-ink-2 ${CARD_DASHED}`}>{wide ? t('Empty folder — drag lines or folders here.') : t('Empty folder.')}</p>}
        />
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {isFirst && (
          <button type="button" onClick={() => setSheet({ kind: 'pick', color: folder.color, first })} className={`pressable flex min-h-[60px] items-center gap-3 px-5 text-start text-md font-semibold text-brand-ink hover:bg-surface-2 ${CARD_DASHED}`}>
            <Plus size={18} aria-hidden /> {folder.color === 'white' ? t('Add a reply to prepare for') : t('Add your answer')}
          </button>
        )}
        {packs.length > 0 && (
          <Link to={`/library/ready?color=${folder.color}&first=${first}&reply=${encodeURIComponent(reply!)}`} className={`pressable flex min-h-[60px] items-center gap-3.5 px-5 py-3 hover:bg-surface-2 ${CARD}`}>
            <Sparkles size={20} className="shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-md font-semibold">{t('Add ready-made lines')}</span>
              <span className="block text-sm text-ink-2">{tn(packs.length, '{n} set to choose from', '{n} sets to choose from')}</span>
            </span>
          </Link>
        )}
        <button type="button" onClick={() => void buildOwn()} className={`pressable flex min-h-[60px] items-center gap-3.5 px-5 py-3 text-start hover:bg-surface-2 ${CARD_DASHED}`}>
          <ListPlus size={20} className="shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-md font-semibold">{t('New line')}</span>
            <span className="block text-sm text-ink-2">{t('Pick its moves yourself — where it goes, where it stops, where it branches.')}</span>
          </span>
        </button>
        <button type="button" onClick={() => newFolder(folder)} className={`pressable flex min-h-[60px] items-center gap-3.5 px-5 py-3 text-start hover:bg-surface-2 ${CARD_DASHED}`}>
          <FolderPlus size={20} className="shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-md font-semibold">{t('New folder')}</span>
            <span className="block text-sm text-ink-2">{t('One step deeper, e.g. an opening or a variation — its lines start from its moves.')}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export function MobileTrail({ folder, folders }: { folder: Folder; folders: Folder[] }) {
  const trail: Folder[] = [];
  let cur = folders.find((f) => f.id === folder.parentId);
  while (cur) {
    trail.unshift(cur);
    cur = folders.find((f) => f.id === cur!.parentId);
  }
  return (
    <nav aria-label={t('Breadcrumb')} className="truncate text-sm text-ink-2">
      {trail.map((f, i) => (
        <span key={f.id}>
          {i > 0 && ' › '}
          <Link to={f.parentId === null ? '/library' : `/library?f=${f.id}`} className="hover:text-ink hover:underline">
            {f.parentId === null ? (f.color === 'white' ? t('As White') : t('As Black')) : t(f.name)}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** White or Black as a small disc: the piece colour itself, never a colour of the theme. */

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repertoire';

