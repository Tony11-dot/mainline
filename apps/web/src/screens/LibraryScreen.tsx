import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  BarChart3,
  BookMarked,
  ChevronRight,
  Download,
  FileUp,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { findConflicts, type Color, type Folder, type Repertoire } from '@mainline/shared';
import { repMoves, repPreview, repStats, useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
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
  | null;

export function LibraryScreen() {
  const lib = useLibrary();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(JSON.parse(sessionStorage.getItem('ml.open') ?? '[]') as string[]));
  useEffect(() => void lib.load(), [lib]);
  useEffect(() => sessionStorage.setItem('ml.open', JSON.stringify([...open])), [open]);

  // PGNs shared/opened from other apps land in the import sheet.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const show = (text: string | null) => text && setSheet({ kind: 'import', text });
    if (params.get('import') === 'shared') {
      void readSharedFromServiceWorker().then(show);
      setParams({}, { replace: true });
    }
    show(takePendingImport());
    return onPendingImport(() => show(takePendingImport()));
  }, [params, setParams]);

  const folders = lib.folders.filter((f) => !f.deleted);
  const reps = lib.reps.filter((r) => !r.deleted);
  const roots = folders.filter((f) => f.parentId === null).sort((a, b) => a.sortIndex - b.sortIndex);
  const conflicts = useMemo(() => findConflicts(reps, lib.moves), [lib.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ctx: TreeCtx = {
    folders,
    reps,
    open,
    toggle,
    setSheet,
    moves: lib.moves,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('Repertoire')}</h1>
        <div className="flex items-center gap-1">
          <Link to="/stats" aria-label={t('Statistics')} className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <BarChart3 size={18} aria-hidden /> <span className="hidden sm:inline">{t('Statistics')}</span>
          </Link>
          <Link to="/library/openings" className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <Search size={18} aria-hidden /> <span className="hidden sm:inline">{t('Openings')}</span>
          </Link>
          <Menu
            label={t('Add')}
            items={[
              { label: t('New repertoire'), icon: BookMarked, onSelect: () => setSheet({ kind: 'new-rep', folderId: roots.find((r) => r.color === 'white')?.id ?? null, color: 'white' }) },
              { label: t('New folder'), icon: FolderPlus, onSelect: () => setSheet({ kind: 'new-folder', parentId: roots[0]!.id, color: roots[0]!.color }) },
              { label: t('Import PGN'), icon: FileUp, onSelect: () => setSheet({ kind: 'import' }) },
            ]}
            trigger={(p) => (
              <Button variant="primary" icon={Plus} {...p}>
                {t('New')}
              </Button>
            )}
          />
        </div>
      </div>

      {conflicts.length > 0 && (
        <button type="button" onClick={() => setSheet({ kind: 'conflicts' })} className="mt-5 flex w-full items-center gap-3 rounded-[var(--radius-m)] bg-warn-soft px-4 py-3 text-start">
          <TriangleAlert size={18} className="shrink-0 text-warn" aria-hidden />
          <span className="flex-1 text-sm">
            {tn(conflicts.length, '{n} position where your repertoires disagree on your move.', '{n} positions where your repertoires disagree on your move.')}{' '}
            {t('Training uses one move per position.')}
          </span>
          <ChevronRight size={18} className="text-ink-3 rtl:rotate-180" aria-hidden />
        </button>
      )}

      {!lib.loaded ? null : reps.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-l)] border border-dashed border-line-strong">
          <PanelNote
            icon={BookMarked}
            title={t('Build your first repertoire')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setSheet({ kind: 'new-rep', folderId: roots.find((r) => r.color === 'white')?.id ?? null, color: 'white' })}>
                  {t('New repertoire')}
                </Button>
                <Link to="/library/openings" className="inline-flex h-11 items-center rounded-[12px] border border-line bg-surface px-4 font-semibold shadow-1 hover:bg-surface-2">
                  {t('Browse openings')}
                </Link>
              </div>
            }
          >
            {t('Pick a colour and start playing moves on the board — or start from any named opening.')}
          </PanelNote>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {roots.map((root) => (
          <section key={root.id} aria-label={t(root.name)}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <span className={`inline-block size-3 rounded-full ring-1 ring-line-strong ${root.color === 'white' ? 'bg-white' : 'bg-[oklch(0.25_0.015_262)]'}`} />
                {t(root.name)}
              </h2>
              <FolderMenu folder={root} ctx={ctx} isRoot />
            </div>
            <div className="overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1" onDragOver={(e) => e.preventDefault()}>
              <FolderChildren
                parentId={root.id}
                depth={0}
                ctx={ctx}
                empty={
                  <div className="flex items-center justify-between gap-3 py-2 ps-4 pe-2">
                    <p className="text-sm text-ink-3">{t('None yet.')}</p>
                    <Button variant="ghost" size="sm" icon={Plus} className="text-brand-ink" onClick={() => setSheet({ kind: 'new-rep', folderId: root.id, color: root.color })}>
                      {root.color === 'white' ? t('New White repertoire') : t('New Black repertoire')}
                    </Button>
                  </div>
                }
              />
            </div>
          </section>
        ))}
      </div>

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
          const f = await lib.createFolder(name, sheet.color, sheet.parentId);
          setOpen((s) => new Set([...s, sheet.parentId, f.id]));
        }}
      />
      <PromptSheet
        open={sheet?.kind === 'rename-folder' || sheet?.kind === 'rename-rep'}
        title={t('Rename')}
        label={t('Name')}
        initial={sheet?.kind === 'rename-folder' ? sheet.folder.name : sheet?.kind === 'rename-rep' ? sheet.rep.name : ''}
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
    </div>
  );
}

interface TreeCtx {
  folders: Folder[];
  reps: Repertoire[];
  moves: ReturnType<typeof useLibrary.getState>['moves'];
  open: Set<string>;
  toggle: (id: string) => void;
  setSheet: (s: SheetState) => void;
}

function FolderChildren({ parentId, depth, ctx, empty }: { parentId: string; depth: number; ctx: TreeCtx; empty?: React.ReactNode }) {
  const subs = ctx.folders.filter((f) => f.parentId === parentId).sort((a, b) => a.sortIndex - b.sortIndex);
  const reps = ctx.reps.filter((r) => r.folderId === parentId).sort((a, b) => a.sortIndex - b.sortIndex);
  if (!subs.length && !reps.length) return empty ? empty : <p className="py-2 text-sm text-ink-3" style={{ paddingInlineStart: 16 + (depth + 1) * 20 }}>{t('Empty folder')}</p>;
  return (
    <ul role="group" className="divide-y divide-line">
      {subs.map((f) => (
        <FolderRow key={f.id} folder={f} depth={depth} ctx={ctx} />
      ))}
      {reps.map((r) => (
        <RepRow key={r.id} rep={r} depth={depth} ctx={ctx} />
      ))}
    </ul>
  );
}

function useDropTarget(folderId: string) {
  const [over, setOver] = useState(false);
  const lib = useLibrary();
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('application/x-mainline')) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const data = JSON.parse(e.dataTransfer.getData('application/x-mainline') || '{}') as { type?: string; id?: string };
        if (data.type === 'rep' && data.id) void lib.moveRepertoire(data.id, folderId);
        if (data.type === 'folder' && data.id) void lib.moveFolder(data.id, folderId);
      },
    },
  };
}

const dragProps = (type: 'rep' | 'folder', id: string) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-mainline', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
  },
});

function FolderRow({ folder, depth, ctx }: { folder: Folder; depth: number; ctx: TreeCtx }) {
  const isOpen = ctx.open.has(folder.id);
  const { over, props } = useDropTarget(folder.id);
  const count = countReps(ctx, folder.id);
  return (
    <li role="treeitem" aria-expanded={isOpen}>
      <div
        {...dragProps('folder', folder.id)}
        {...props}
        className={`group flex min-h-[52px] items-center gap-2 pe-2 transition-colors ${over ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
        style={{ paddingInlineStart: 12 + depth * 20 }}
      >
        <button type="button" onClick={() => ctx.toggle(folder.id)} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-start">
          <ChevronRight size={16} className={`shrink-0 text-ink-3 transition-transform duration-150 ${isOpen ? 'rotate-90' : 'rtl:rotate-180'}`} aria-hidden />
          <FolderIcon size={18} className="shrink-0 text-brand" aria-hidden />
          <span className="truncate font-semibold">{t(folder.name)}</span>
          <span className="tnum text-sm text-ink-3">{count}</span>
        </button>
        <FolderMenu folder={folder} ctx={ctx} />
      </div>
      {isOpen && <FolderChildren parentId={folder.id} depth={depth + 1} ctx={ctx} />}
    </li>
  );
}

function countReps(ctx: TreeCtx, folderId: string): number {
  let n = ctx.reps.filter((r) => r.folderId === folderId).length;
  for (const f of ctx.folders.filter((x) => x.parentId === folderId)) n += countReps(ctx, f.id);
  return n;
}

function FolderMenu({ folder, ctx, isRoot }: { folder: Folder; ctx: TreeCtx; isRoot?: boolean }) {
  const lib = useLibrary();
  const items: MenuItem[] = [
    { label: t('New repertoire here'), icon: BookMarked, onSelect: () => ctx.setSheet({ kind: 'new-rep', folderId: folder.id, color: folder.color }) },
    { label: t('New subfolder'), icon: FolderPlus, onSelect: () => ctx.setSheet({ kind: 'new-folder', parentId: folder.id, color: folder.color }) },
    { label: t('Rename'), icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-folder', folder }) },
  ];
  if (!isRoot) {
    items.push({ label: t('Move to…'), icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'folder', folder } }) });
    items.push({
      label: t('Delete folder'),
      icon: Trash2,
      onSelect: async () => {
        const undo = await lib.deleteFolder(folder.id);
        undoToast(t('Deleted “{name}”', { name: folder.name }), undo);
      },
      danger: true,
    });
  }
  return <Menu label={t('{name} actions', { name: t(folder.name) })} items={items} trigger={(p) => <IconButton icon={MoreHorizontal} label={t('{name} actions', { name: t(folder.name) })} size={40} {...p} />} />;
}

function RepRow({ rep, depth, ctx }: { rep: Repertoire; depth: number; ctx: TreeCtx }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const stats = useMemo(() => repStats(ctx.moves, rep), [ctx.moves, rep]);
  const preview = useMemo(() => repPreview(ctx.moves, rep), [ctx.moves, rep]);
  const cards = useTraining((t) => t.cards);
  return (
    <li role="treeitem" aria-selected={false}>
      <div {...dragProps('rep', rep.id)} className="flex min-h-[60px] items-center gap-2 pe-2 hover:bg-surface-2" style={{ paddingInlineStart: 12 + depth * 20 }}>
        <Link to={`/rep/${rep.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3" style={{ paddingInlineStart: depth ? 24 : 4 }}>
          <MiniBoard fen={preview.epd} lastMove={preview.lastUci} orientation={rep.color} size={52} className="rounded-[7px]" decorative />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{rep.name}</span>
            <span className="tnum block text-sm text-ink-2">
              {tn(stats.positions, '{n} position to know', '{n} positions to know')} · {tn(stats.moves, '{n} move', '{n} moves')}
            </span>
            <MasteryStrip rep={rep} moves={repMoves(ctx.moves, rep.id)} cards={cards} now={Date.now()} />
          </span>
        </Link>
        <Menu
          label={t('{name} actions', { name: rep.name })}
          items={[
            { label: t('Open builder'), icon: BookMarked, onSelect: () => nav(`/rep/${rep.id}`) },
            { label: t('Rename'), icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-rep', rep }) },
            { label: t('Move to…'), icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'rep', rep } }) },
            { label: t('Import PGN into this'), icon: FileUp, onSelect: () => ctx.setSheet({ kind: 'import', repId: rep.id }) },
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
