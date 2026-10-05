import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  ChevronRight,
  Download,
  FileUp,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Hammer,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Swords,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { findConflicts, isReadyMade, type Color, type Folder, type Repertoire } from '@mainline/shared';
import { folderMoves, repMoves, repPreview, repsUnder, useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { useGames } from '../lib/games';
import { PACKS, openingRecords, recordFor, replySan, weakSpots, type FirstMove, type OpeningRecord } from '../lib/packs';
import { MasteryStrip } from '../ui/MasteryStrip';
import { MiniBoard } from '../ui/MiniBoard';
import { platform } from '../platform';
import { Button, IconButton, PanelNote } from '../ui/primitives';
import { Menu, type MenuItem } from '../ui/Menu';
import { undoToast, toast } from '../ui/toast';
import { NewRepertoireSheet } from './library/NewRepertoireSheet';
import { MoveToSheet } from './library/MoveToSheet';
import { PromptSheet } from './library/PromptSheet';
import { ImportPgnSheet } from './library/ImportPgnSheet';
import { ConflictsSheet } from './library/ConflictsSheet';
import { OpeningPickerSheet } from './library/OpeningPickerSheet';
import { PracticeButtons, ProgressText, RecordBadge, scopeProgress } from './library/practiceUi';
import { WeakSpotCard } from './library/WeakSpotCard';
import { onPendingImport, readSharedFromServiceWorker, takePendingImport } from '../lib/incoming';
import { msg, t, tn } from '../lib/i18n';

// The default root folders are created as “White” and “Black”: shown in the app language.
msg('White');
msg('Black');

type SheetState =
  | { kind: 'new-rep'; folderId: string | null; color: Color }
  | { kind: 'new-folder'; parentId: string; color: Color }
  | { kind: 'rename-folder'; folder: Folder }
  | { kind: 'rename-rep'; rep: Repertoire }
  | { kind: 'move'; item: { type: 'folder'; folder: Folder } | { type: 'rep'; rep: Repertoire } }
  | { kind: 'import'; repId?: string; text?: string }
  | { kind: 'conflicts' }
  | { kind: 'pick'; color: Color; first?: FirstMove }
  | null;

const FIRSTS: Record<string, FirstMove> = { e2e4: 'e4', d2d4: 'd4', c2c4: 'c4' };

/** Where a folder sits in the opening hierarchy, from the position it stands for. */
function folderLevel(moves: string[]): { first?: FirstMove; reply?: string } {
  const first = FIRSTS[moves[0] ?? ''];
  if (!first) return {};
  return { first, reply: moves.length >= 2 ? moves[1] : undefined };
}

/**
 * The repertoire, organised as players think about it: White and Black, then each first move, then each
 * opening, then its lines. Every level can be practised on its own — with the moves shown or from memory.
 */
export function LibraryScreen() {
  const lib = useLibrary();
  const cards = useTraining((s) => s.cards);
  const games = useGames((g) => g.games);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [params, setParams] = useSearchParams();
  const folderId = params.get('f');
  useEffect(() => {
    void lib.load();
    void useTraining.getState().load();
    void useGames.getState().load();
  }, [lib]);

  // PGNs shared/opened from other apps land in the import sheet.
  useEffect(() => {
    const show = (text: string | null) => text && setSheet({ kind: 'import', text });
    if (params.get('import') === 'shared') {
      void readSharedFromServiceWorker().then(show);
      setParams({}, { replace: true });
    }
    show(takePendingImport());
    return onPendingImport(() => show(takePendingImport()));
  }, [params, setParams]);

  const folders = useMemo(() => lib.folders.filter((f) => !f.deleted), [lib.folders]);
  const reps = useMemo(() => lib.reps.filter((r) => !r.deleted), [lib.reps]);
  const roots = folders.filter((f) => f.parentId === null).sort((a, b) => a.sortIndex - b.sortIndex);
  const conflicts = useMemo(() => findConflicts(reps, lib.moves), [lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const records = useMemo(() => openingRecords(games), [games]);
  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;

  const ctx: Ctx = { folders, reps, moves: lib.moves, cards, records, setSheet };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      {folder ? <FolderView folder={folder} ctx={ctx} /> : <RootView roots={roots} ctx={ctx} conflicts={conflicts.length} hasGames={games.length > 0} loaded={lib.loaded} />}

      <NewRepertoireSheet open={sheet?.kind === 'new-rep'} initial={sheet?.kind === 'new-rep' ? sheet : undefined} onClose={() => setSheet(null)} />
      <PromptSheet
        open={sheet?.kind === 'new-folder'}
        title={t('New folder')}
        label={t('Name')}
        placeholder={t('e.g. vs 1.e4')}
        confirm={t('Create')}
        onClose={() => setSheet(null)}
        onSubmit={async (name) => {
          if (sheet?.kind !== 'new-folder') return;
          await lib.createFolder(name, sheet.color, sheet.parentId);
        }}
      />
      <PromptSheet
        open={sheet?.kind === 'rename-folder' || sheet?.kind === 'rename-rep'}
        title={t('Rename')}
        label={t('Name')}
        initial={sheet?.kind === 'rename-folder' ? t(sheet.folder.name) : sheet?.kind === 'rename-rep' ? sheet.rep.name : ''}
        confirm={t('Save')}
        onClose={() => setSheet(null)}
        onSubmit={async (name) => {
          if (sheet?.kind === 'rename-folder') await lib.renameFolder(sheet.folder.id, name);
          if (sheet?.kind === 'rename-rep') await lib.renameRepertoire(sheet.rep.id, name);
        }}
      />
      <MoveToSheet open={sheet?.kind === 'move'} item={sheet?.kind === 'move' ? sheet.item : undefined} onClose={() => setSheet(null)} />
      <ImportPgnSheet open={sheet?.kind === 'import'} repId={sheet?.kind === 'import' ? sheet.repId : undefined} initialText={sheet?.kind === 'import' ? sheet.text : undefined} onClose={() => setSheet(null)} />
      <ConflictsSheet open={sheet?.kind === 'conflicts'} conflicts={conflicts} onClose={() => setSheet(null)} />
      <OpeningPickerSheet open={sheet?.kind === 'pick'} color={sheet?.kind === 'pick' ? sheet.color : 'white'} first={sheet?.kind === 'pick' ? sheet.first : undefined} onClose={() => setSheet(null)} />
    </div>
  );
}

interface Ctx {
  folders: Folder[];
  reps: Repertoire[];
  moves: ReturnType<typeof useLibrary.getState>['moves'];
  cards: ReturnType<typeof useTraining.getState>['cards'];
  records: OpeningRecord[];
  setSheet: (s: SheetState) => void;
}

/* ---------------- Top level: White and Black ---------------- */

function RootView({ roots, ctx, conflicts, hasGames, loaded }: { roots: Folder[]; ctx: Ctx; conflicts: number; hasGames: boolean; loaded: boolean }) {
  const nav = useNavigate();
  const games = useGames((g) => g.games);
  const spot = useMemo(() => weakSpots(games)[0], [games]);
  const all = useMemo(() => scopeProgress(ctx.reps, ctx.moves, ctx.cards), [ctx.reps, ctx.moves, ctx.cards]);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('Repertoire')}</h1>
        <div className="flex items-center gap-1">
          <Link to="/stats" aria-label={t('Statistics')} className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <BarChart3 size={18} aria-hidden /> <span className="hidden sm:inline">{t('Statistics')}</span>
          </Link>
          <Menu
            label={t('New')}
            items={[
              { label: t('Ready-made openings'), icon: Sparkles, onSelect: () => nav('/library/ready') },
              { label: t('New repertoire'), icon: BookMarked, onSelect: () => ctx.setSheet({ kind: 'new-rep', folderId: roots.find((r) => r.color === 'white')?.id ?? null, color: 'white' }) },
              { label: t('Browse openings by name'), icon: Search, onSelect: () => nav('/library/openings') },
              { label: t('Import PGN'), icon: FileUp, onSelect: () => ctx.setSheet({ kind: 'import' }) },
            ]}
            trigger={(p) => (
              <Button variant="primary" icon={Plus} {...p}>
                {t('New')}
              </Button>
            )}
          />
        </div>
      </div>

      {spot ? (
        <div className="mt-5">
          <WeakSpotCard spot={spot} />
        </div>
      ) : !hasGames && loaded ? (
        <Link to="/games" className="mt-5 flex items-center gap-3 rounded-[var(--radius-l)] border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2 hover:bg-surface-2">
          <Swords size={18} className="shrink-0 text-brand" aria-hidden />
          <span className="flex-1">{t('Import your games and MainLine finds the openings you lose most — then hands you ready-made lines for them.')}</span>
          <ChevronRight size={18} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
        </Link>
      ) : null}

      {conflicts > 0 && (
        <button type="button" onClick={() => ctx.setSheet({ kind: 'conflicts' })} className="mt-5 flex w-full items-center gap-3 rounded-[var(--radius-m)] bg-warn-soft px-4 py-3 text-start">
          <TriangleAlert size={18} className="shrink-0 text-warn" aria-hidden />
          <span className="flex-1 text-sm">
            {tn(conflicts, '{n} position where your repertoires disagree on your move.', '{n} positions where your repertoires disagree on your move.')} {t('Training uses one move per position.')}
          </span>
          <ChevronRight size={18} className="text-ink-3 rtl:rotate-180" aria-hidden />
        </button>
      )}

      {loaded && ctx.reps.length === 0 && (
        <div className="mt-6 rounded-[var(--radius-l)] border border-dashed border-line-strong">
          <PanelNote
            icon={BookMarked}
            title={t('Build your first repertoire')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/library/ready" className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-brand px-4 font-semibold text-on-brand">
                  <Sparkles size={18} aria-hidden /> {t('Ready-made openings')}
                </Link>
                <Button onClick={() => ctx.setSheet({ kind: 'pick', color: 'white' })}>{t('Build my own')}</Button>
              </div>
            }
          >
            {t('Start from ready-made lines to practise straight away, or build your own move by move with suggestions.')}
          </PanelNote>
        </div>
      )}

      {ctx.reps.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1">
          <div>
            <h2 className="font-bold">{t('Everything')}</h2>
            <p className="tnum text-sm text-ink-2">
              <ProgressText p={all} />
            </p>
          </div>
          <PracticeButtons scope={{ kind: 'all' }} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {roots.map((root) => (
          <ColorSection key={root.id} root={root} ctx={ctx} />
        ))}
      </div>
    </>
  );
}

function ColorSection({ root, ctx }: { root: Folder; ctx: Ctx }) {
  const inside = useMemo(() => ctx.reps.filter((r) => r.color === root.color), [ctx.reps, root.color]);
  const progress = useMemo(() => scopeProgress(inside, ctx.moves, ctx.cards), [inside, ctx.moves, ctx.cards]);
  const subs = ctx.folders.filter((f) => f.parentId === root.id).sort(byFirstMove);
  const loose = ctx.reps.filter((r) => r.folderId === root.id).sort((a, b) => a.sortIndex - b.sortIndex);
  return (
    <section aria-label={t(root.name)}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className={`inline-block size-3.5 rounded-full ring-1 ring-line-strong ${root.color === 'white' ? 'bg-white' : 'bg-[oklch(0.25_0.015_262)]'}`} />
            {root.color === 'white' ? t('As White') : t('As Black')}
          </h2>
          <p className="tnum text-sm text-ink-2">
            <ProgressText p={progress} />
          </p>
        </div>
        {inside.length > 0 && <PracticeButtons scope={{ kind: 'color', color: root.color }} size="sm" />}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
        {subs.map((f) => (
          <FolderRow key={f.id} folder={f} ctx={ctx} />
        ))}
        {loose.map((r) => (
          <LineRow key={r.id} rep={r} ctx={ctx} />
        ))}
        <li>
          <button type="button" onClick={() => ctx.setSheet({ kind: 'pick', color: root.color })} className="flex min-h-[52px] w-full items-center gap-2 px-4 text-start font-semibold text-brand-ink hover:bg-surface-2">
            <Plus size={18} aria-hidden /> {root.color === 'white' ? t('Add a first move') : t('Add a first move to answer')}
          </button>
        </li>
      </ul>
    </section>
  );
}

const ORDER = ['e2e4', 'd2d4', 'c2c4'];
function byFirstMove(a: Folder, b: Folder) {
  const ia = ORDER.indexOf(a.rootMovesUci?.[0] ?? '');
  const ib = ORDER.indexOf(b.rootMovesUci?.[0] ?? '');
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.sortIndex - b.sortIndex;
}

/* ---------------- Inside a folder: openings, then lines ---------------- */

function FolderView({ folder, ctx }: { folder: Folder; ctx: Ctx }) {
  const nav = useNavigate();
  const lib = useLibrary();
  const trail = useMemo(() => {
    const out: Folder[] = [];
    let cur = ctx.folders.find((f) => f.id === folder.parentId);
    while (cur) {
      out.unshift(cur);
      cur = ctx.folders.find((f) => f.id === cur!.parentId);
    }
    return out;
  }, [ctx.folders, folder.parentId]);
  const inside = useMemo(() => repsUnder(ctx.folders, ctx.reps, folder.id), [ctx.folders, ctx.reps, folder.id]);
  const progress = useMemo(() => scopeProgress(inside, ctx.moves, ctx.cards), [inside, ctx.moves, ctx.cards]);
  const subs = ctx.folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.sortIndex - b.sortIndex);
  const lines = ctx.reps.filter((r) => r.folderId === folder.id).sort((a, b) => Number(isReadyMade(b)) - Number(isReadyMade(a)) || a.sortIndex - b.sortIndex);
  const at = folderMoves(ctx.folders, ctx.reps, folder.id);
  const { first, reply } = folderLevel(at);
  const isOpening = !!(first && reply && at.length === 2);
  const isFirst = !!(first && at.length === 1);
  const rec = first && reply ? recordFor(ctx.records, folder.color, first, replySan(first, reply)) : undefined;
  const packs = isOpening ? PACKS.filter((p) => p.color === folder.color && p.first === first && replySan(first!, reply!) === p.reply) : [];
  const parent = trail.at(-1);

  const buildOwn = async () => {
    const n = lines.filter((r) => !isReadyMade(r)).length + 1;
    const rep = await lib.createRepertoire({ name: t('My line {n}', { n }), color: folder.color, folderId: folder.id, rootMovesUci: at });
    nav(`/rep/${rep.id}?guide=1`);
  };

  const menu: MenuItem[] = [
    { label: t('Rename'), icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-folder', folder }) },
    { label: t('New subfolder'), icon: FolderPlus, onSelect: () => ctx.setSheet({ kind: 'new-folder', parentId: folder.id, color: folder.color }) },
    { label: t('Move to…'), icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'folder', folder } }) },
    {
      label: t('Delete folder'),
      icon: Trash2,
      danger: true,
      onSelect: async () => {
        const undo = await lib.deleteFolder(folder.id);
        nav(parent && parent.parentId !== null ? `/library?f=${parent.id}` : '/library', { replace: true });
        undoToast(t('Deleted “{name}”', { name: t(folder.name) }), undo);
      },
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <Link to={parent && parent.parentId !== null ? `/library?f=${parent.id}` : '/library'} className="-ms-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back')}>
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </Link>
        <nav aria-label={t('Breadcrumb')} className="min-w-0 flex-1 truncate text-sm text-ink-3">
          {trail.map((f, i) => (
            <span key={f.id}>
              {i > 0 && ' › '}
              <Link to={f.parentId === null ? '/library' : `/library?f=${f.id}`} className="hover:text-ink hover:underline">
                {f.parentId === null ? (f.color === 'white' ? t('As White') : t('As Black')) : t(f.name)}
              </Link>
            </span>
          ))}
        </nav>
        <Menu label={t('{name} actions', { name: t(folder.name) })} items={menu} trigger={(p) => <IconButton icon={MoreHorizontal} label={t('{name} actions', { name: t(folder.name) })} size={40} {...p} />} />
      </div>
      <h1 className="mt-1 text-2xl font-bold">{t(folder.name)}</h1>
      <p className="tnum mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <ProgressText p={progress} />
        <RecordBadge rec={rec} />
      </p>
      {inside.length > 0 && (
        <div className="mt-4">
          <PracticeButtons scope={{ kind: 'folder', id: folder.id }} />
        </div>
      )}

      {subs.length > 0 && (
        <>
          <h2 className="mt-7 mb-2 px-1 text-sm font-semibold text-ink-2">{isFirst ? t('Openings') : t('Folders')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
            {subs.map((f) => (
              <FolderRow key={f.id} folder={f} ctx={ctx} />
            ))}
          </ul>
        </>
      )}
      {isFirst && (
        <button type="button" onClick={() => ctx.setSheet({ kind: 'pick', color: folder.color, first })} className="mt-2 flex min-h-[52px] w-full items-center gap-2 rounded-[var(--radius-l)] border border-dashed border-line-strong px-4 text-start font-semibold text-brand-ink hover:bg-surface-2">
          <Plus size={18} aria-hidden /> {folder.color === 'white' ? t('Add a reply to prepare for') : t('Add your answer')}
        </button>
      )}

      {(lines.length > 0 || !isFirst) && <h2 className="mt-7 mb-2 px-1 text-sm font-semibold text-ink-2">{t('Lines')}</h2>}
      {lines.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
          {lines.map((r) => (
            <LineRow key={r.id} rep={r} ctx={ctx} />
          ))}
        </ul>
      )}
      {!isFirst && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {packs.length > 0 && (
            <Link to={`/library/ready?color=${folder.color}&first=${first}&reply=${encodeURIComponent(replySan(first!, reply!))}`} className="flex min-h-[64px] items-center gap-3 rounded-[var(--radius-l)] border border-line bg-surface px-4 py-3 shadow-1 hover:bg-surface-2">
              <Sparkles size={20} className="shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t('Add ready-made lines')}</span>
                <span className="block text-sm text-ink-2">{tn(packs.length, '{n} set to choose from', '{n} sets to choose from')}</span>
              </span>
            </Link>
          )}
          <button type="button" onClick={() => void (isOpening || at.length ? buildOwn() : ctx.setSheet({ kind: 'new-rep', folderId: folder.id, color: folder.color }))} className="flex min-h-[64px] items-center gap-3 rounded-[var(--radius-l)] border border-dashed border-line-strong px-4 py-3 text-start hover:bg-surface-2">
            <Hammer size={20} className="shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('Build a line myself')}</span>
              <span className="block text-sm text-ink-2">{t('Play the moves, with suggestions for both sides.')}</span>
            </span>
          </button>
        </div>
      )}
    </>
  );
}

function FolderRow({ folder, ctx }: { folder: Folder; ctx: Ctx }) {
  const inside = useMemo(() => repsUnder(ctx.folders, ctx.reps, folder.id), [ctx.folders, ctx.reps, folder.id]);
  const progress = useMemo(() => scopeProgress(inside, ctx.moves, ctx.cards), [inside, ctx.moves, ctx.cards]);
  const at = folder.rootMovesUci ?? [];
  const { first, reply } = folderLevel(at);
  const rec = first && reply && at.length === 2 ? recordFor(ctx.records, folder.color, first, replySan(first, reply)) : undefined;
  const openings = ctx.folders.filter((f) => f.parentId === folder.id).length;
  return (
    <li>
      <Link to={`/library?f=${folder.id}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
        <FolderIcon size={20} className="shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t(folder.name)}</span>
          <span className="tnum block text-sm text-ink-2">
            {openings > 0 && `${tn(openings, '{n} opening', '{n} openings')} · `}
            <ProgressText p={progress} />
          </span>
        </span>
        <RecordBadge rec={rec} />
        <ChevronRight size={18} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}

function LineRow({ rep, ctx }: { rep: Repertoire; ctx: Ctx }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const preview = useMemo(() => repPreview(ctx.moves, rep), [ctx.moves, rep]);
  const ready = isReadyMade(rep);
  return (
    <li>
      <div className="flex min-h-[64px] items-center gap-2 pe-2">
        <Link to={`/rep/${rep.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-2.5 ps-3">
          <MiniBoard fen={preview.epd} lastMove={preview.lastUci} orientation={rep.color} size={52} className="rounded-[7px]" decorative />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{rep.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-3">
              {ready ? (
                <>
                  <Sparkles size={12} aria-hidden /> {t('Ready-made')}
                </>
              ) : (
                <>
                  <Hammer size={12} aria-hidden /> {t('Your line')}
                </>
              )}
            </span>
            <MasteryStrip rep={rep} moves={repMoves(ctx.moves, rep.id)} cards={ctx.cards} now={Date.now()} />
          </span>
        </Link>
        <Menu
          label={t('{name} actions', { name: rep.name })}
          items={[
            { label: t('Show me'), icon: BookMarked, onSelect: () => nav(`/train?mode=learn&show=1&reps=${rep.id}`) },
            { label: t('Rename'), icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-rep', rep }) },
            { label: t('Move to…'), icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'rep', rep } }) },
            ...(ready ? [] : [{ label: t('Import PGN into this'), icon: FileUp, onSelect: () => ctx.setSheet({ kind: 'import', repId: rep.id }) }]),
            {
              label: t('Export PGN'),
              icon: Download,
              onSelect: async () => {
                const pgn = lib.exportPgn(rep.id);
                await platform().share({ title: rep.name, file: { name: `${slug(rep.name)}.pgn`, content: pgn } });
                toast(t('PGN exported'), { kind: 'success' });
              },
            },
            {
              label: t('Delete'),
              icon: Trash2,
              danger: true,
              onSelect: async () => {
                const undo = await lib.deleteRepertoire(rep.id);
                undoToast(t('Deleted “{name}”', { name: rep.name }), undo);
              },
            },
          ]}
          trigger={(p) => <IconButton icon={MoreHorizontal} label={t('{name} actions', { name: rep.name })} size={40} {...p} />}
        />
      </div>
    </li>
  );
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repertoire';
