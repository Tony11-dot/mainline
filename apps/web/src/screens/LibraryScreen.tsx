import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
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
import { repStats, useLibrary } from '../lib/library';
import { platform } from '../platform';
import { Button, IconButton, PanelNote } from '../ui/primitives';
import { Menu, type MenuItem } from '../ui/Menu';
import { undoToast, toast } from '../ui/toast';
import { NewRepertoireSheet } from './library/NewRepertoireSheet';
import { MoveToSheet } from './library/MoveToSheet';
import { PromptSheet } from './library/PromptSheet';
import { ImportPgnSheet } from './library/ImportPgnSheet';
import { ConflictsSheet } from './library/ConflictsSheet';

type SheetState =
  | { kind: 'new-rep'; folderId: string | null; color: Color }
  | { kind: 'new-folder'; parentId: string; color: Color }
  | { kind: 'rename-folder'; folder: Folder }
  | { kind: 'rename-rep'; rep: Repertoire }
  | { kind: 'move'; item: { type: 'folder'; folder: Folder } | { type: 'rep'; rep: Repertoire } }
  | { kind: 'import'; repId?: string }
  | { kind: 'conflicts' }
  | null;

export function LibraryScreen() {
  const lib = useLibrary();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(JSON.parse(sessionStorage.getItem('ml.open') ?? '[]') as string[]));
  useEffect(() => void lib.load(), [lib]);
  useEffect(() => sessionStorage.setItem('ml.open', JSON.stringify([...open])), [open]);

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
        <h1 className="text-2xl font-bold">Repertoire</h1>
        <div className="flex items-center gap-1">
          <Link to="/library/openings" className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <Search size={18} aria-hidden /> <span className="hidden sm:inline">Openings</span>
          </Link>
          <Menu
            label="Add"
            items={[
              { label: 'New repertoire', icon: BookMarked, onSelect: () => setSheet({ kind: 'new-rep', folderId: roots.find((r) => r.color === 'white')?.id ?? null, color: 'white' }) },
              { label: 'New folder', icon: FolderPlus, onSelect: () => setSheet({ kind: 'new-folder', parentId: roots[0]!.id, color: roots[0]!.color }) },
              { label: 'Import PGN', icon: FileUp, onSelect: () => setSheet({ kind: 'import' }) },
            ]}
            trigger={(p) => (
              <Button variant="primary" icon={Plus} {...p}>
                New
              </Button>
            )}
          />
        </div>
      </div>

      {conflicts.length > 0 && (
        <button type="button" onClick={() => setSheet({ kind: 'conflicts' })} className="mt-5 flex w-full items-center gap-3 rounded-[var(--radius-m)] bg-warn-soft px-4 py-3 text-left">
          <TriangleAlert size={18} className="shrink-0 text-warn" aria-hidden />
          <span className="flex-1 text-sm">
            <b>
              {conflicts.length} position{conflicts.length > 1 ? 's' : ''}
            </b>{' '}
            where your repertoires disagree on your move. Training uses one move per position.
          </span>
          <ChevronRight size={18} className="text-ink-3" aria-hidden />
        </button>
      )}

      {!lib.loaded ? null : reps.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-l)] border border-dashed border-line-strong">
          <PanelNote
            icon={BookMarked}
            title="Build your first repertoire"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setSheet({ kind: 'new-rep', folderId: roots.find((r) => r.color === 'white')?.id ?? null, color: 'white' })}>
                  New repertoire
                </Button>
                <Link to="/library/openings" className="inline-flex h-11 items-center rounded-[12px] border border-line bg-surface px-4 font-semibold shadow-1 hover:bg-surface-2">
                  Browse openings
                </Link>
              </div>
            }
          >
            Pick a colour and start playing moves on the board — or start from any named opening.
          </PanelNote>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {roots.map((root) => (
          <section key={root.id} aria-label={root.name}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <span className={`inline-block size-3 rounded-full ring-1 ring-line-strong ${root.color === 'white' ? 'bg-white' : 'bg-[oklch(0.25_0.015_262)]'}`} />
                {root.name}
              </h2>
              <FolderMenu folder={root} ctx={ctx} isRoot />
            </div>
            <div className="overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1" onDragOver={(e) => e.preventDefault()}>
              <FolderChildren parentId={root.id} depth={0} ctx={ctx} emptyText={`No ${root.color} repertoires yet.`} />
            </div>
          </section>
        ))}
      </div>

      <NewRepertoireSheet open={sheet?.kind === 'new-rep'} initial={sheet?.kind === 'new-rep' ? sheet : undefined} onClose={() => setSheet(null)} />
      <PromptSheet
        open={sheet?.kind === 'new-folder'}
        title="New folder"
        label="Name"
        placeholder="e.g. vs 1.e4"
        confirm="Create"
        onClose={() => setSheet(null)}
        onSubmit={async (name) => {
          if (sheet?.kind !== 'new-folder') return;
          const f = await lib.createFolder(name, sheet.color, sheet.parentId);
          setOpen((s) => new Set([...s, sheet.parentId, f.id]));
        }}
      />
      <PromptSheet
        open={sheet?.kind === 'rename-folder' || sheet?.kind === 'rename-rep'}
        title="Rename"
        label="Name"
        initial={sheet?.kind === 'rename-folder' ? sheet.folder.name : sheet?.kind === 'rename-rep' ? sheet.rep.name : ''}
        confirm="Save"
        onClose={() => setSheet(null)}
        onSubmit={async (name) => {
          if (sheet?.kind === 'rename-folder') await lib.renameFolder(sheet.folder.id, name);
          if (sheet?.kind === 'rename-rep') await lib.renameRepertoire(sheet.rep.id, name);
        }}
      />
      <MoveToSheet open={sheet?.kind === 'move'} item={sheet?.kind === 'move' ? sheet.item : undefined} onClose={() => setSheet(null)} />
      <ImportPgnSheet open={sheet?.kind === 'import'} repId={sheet?.kind === 'import' ? sheet.repId : undefined} onClose={() => setSheet(null)} />
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

function FolderChildren({ parentId, depth, ctx, emptyText }: { parentId: string; depth: number; ctx: TreeCtx; emptyText?: string }) {
  const subs = ctx.folders.filter((f) => f.parentId === parentId).sort((a, b) => a.sortIndex - b.sortIndex);
  const reps = ctx.reps.filter((r) => r.folderId === parentId).sort((a, b) => a.sortIndex - b.sortIndex);
  if (!subs.length && !reps.length) return emptyText ? <p className="px-4 py-4 text-sm text-ink-3">{emptyText}</p> : <p className="py-2 text-sm text-ink-3" style={{ paddingLeft: 16 + (depth + 1) * 20 }}>Empty folder</p>;
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
        className={`group flex min-h-[52px] items-center gap-2 pr-2 transition-colors ${over ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <button type="button" onClick={() => ctx.toggle(folder.id)} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left">
          <ChevronRight size={16} className={`shrink-0 text-ink-3 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
          <FolderIcon size={18} className="shrink-0 text-brand" aria-hidden />
          <span className="truncate font-semibold">{folder.name}</span>
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
    { label: 'New repertoire here', icon: BookMarked, onSelect: () => ctx.setSheet({ kind: 'new-rep', folderId: folder.id, color: folder.color }) },
    { label: 'New subfolder', icon: FolderPlus, onSelect: () => ctx.setSheet({ kind: 'new-folder', parentId: folder.id, color: folder.color }) },
    { label: 'Rename', icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-folder', folder }) },
  ];
  if (!isRoot) {
    items.push({ label: 'Move to…', icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'folder', folder } }) });
    items.push({
      label: 'Delete folder',
      icon: Trash2,
      onSelect: async () => {
        const undo = await lib.deleteFolder(folder.id);
        undoToast(`Deleted “${folder.name}”`, undo);
      },
      danger: true,
    });
  }
  return <Menu label={`${folder.name} actions`} items={items} trigger={(p) => <IconButton icon={MoreHorizontal} label={`${folder.name} actions`} size={40} {...p} />} />;
}

function RepRow({ rep, depth, ctx }: { rep: Repertoire; depth: number; ctx: TreeCtx }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const stats = useMemo(() => repStats(ctx.moves, rep), [ctx.moves, rep]);
  return (
    <li role="treeitem" aria-selected={false}>
      <div {...dragProps('rep', rep.id)} className="flex min-h-[60px] items-center gap-2 pr-2 hover:bg-surface-2" style={{ paddingLeft: 12 + depth * 20 }}>
        <Link to={`/rep/${rep.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5" style={{ paddingLeft: 24 }}>
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] text-base ring-1 ring-line ${rep.color === 'white' ? 'bg-white text-[oklch(0.25_0.02_262)]' : 'bg-[oklch(0.25_0.015_262)] text-white'}`} aria-hidden>
            {rep.color === 'white' ? '♔' : '♚'}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{rep.name}</span>
            <span className="tnum block text-sm text-ink-2">
              {stats.positions} position{stats.positions === 1 ? '' : 's'} to know · {stats.moves} moves
            </span>
          </span>
        </Link>
        <Menu
          label={`${rep.name} actions`}
          items={[
            { label: 'Open builder', icon: BookMarked, onSelect: () => nav(`/rep/${rep.id}`) },
            { label: 'Rename', icon: Pencil, onSelect: () => ctx.setSheet({ kind: 'rename-rep', rep }) },
            { label: 'Move to…', icon: FolderInput, onSelect: () => ctx.setSheet({ kind: 'move', item: { type: 'rep', rep } }) },
            { label: 'Import PGN into this', icon: FileUp, onSelect: () => ctx.setSheet({ kind: 'import', repId: rep.id }) },
            {
              label: 'Export PGN',
              icon: Download,
              onSelect: async () => {
                const pgn = lib.exportPgn(rep.id);
                await platform().share({ title: rep.name, file: { name: `${slug(rep.name)}.pgn`, content: pgn } });
                toast('PGN exported', { kind: 'success' });
              },
            },
            {
              label: 'Delete',
              icon: Trash2,
              danger: true,
              onSelect: async () => {
                const undo = await lib.deleteRepertoire(rep.id);
                undoToast(`Deleted “${rep.name}”`, undo);
              },
            },
          ]}
          trigger={(p) => <IconButton icon={MoreHorizontal} label={`${rep.name} actions`} size={40} {...p} />}
        />
      </div>
    </li>
  );
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repertoire';
