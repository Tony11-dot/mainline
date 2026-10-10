import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookMarked,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileUp,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Hammer,
  ListPlus,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { findConflicts, isReadyMade, type Color, type Folder, type Repertoire } from '@mainline/shared';
import { descendants, folderMoves, repMoves, repPreview, repsUnder, useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { useGames } from '../lib/games';
import { PACKS, openingRecords, recordFor, replySan, tidyPackLines, weakSpots, type FirstMove, type OpeningRecord } from '../lib/packs';
import { practiceHref, type Scope } from '../lib/practice';
import { MasteryStrip } from '../ui/MasteryStrip';
import { MiniBoard } from '../ui/MiniBoard';
import { platform } from '../platform';
import { Button, IconButton, PanelNote } from '../ui/primitives';
import { CARD, CARD_DASHED, Card } from '../ui/kit';
import { Menu, type MenuItem } from '../ui/Menu';
import { ContextMenu } from '../ui/ContextMenu';
import { undoToast, toast } from '../ui/toast';
import { useMediaQuery } from '../ui/useMediaQuery';
import { NewFolderSheet } from './library/NewFolderSheet';
import { FolderSettingsSheet } from './library/FolderSettingsSheet';
import { ImportPgnSheet } from './library/ImportPgnSheet';
import { ConflictsSheet } from './library/ConflictsSheet';
import { OpeningPickerSheet } from './library/OpeningPickerSheet';
import { MoveSheet } from './library/MoveSheet';
import { PracticeButtons, ProgressText, RecordBadge, scopeProgress } from './library/practiceUi';
import { WeakSpotCard } from './library/WeakSpotCard';
import { onPendingImport, readSharedFromServiceWorker, takePendingImport } from '../lib/incoming';
import { msg, t, tn } from '../lib/i18n';

// The default root folders are created as “White” and “Black”: shown in the app language.
msg('White');
msg('Black');

type Item = { key: string; type: 'folder'; folder: Folder; color: Color } | { key: string; type: 'rep'; rep: Repertoire; color: Color };
type SheetState = { kind: 'new-folder'; folderId: string | null; color: Color } | { kind: 'folder-settings'; id: string } | { kind: 'import'; repId?: string; text?: string } | { kind: 'conflicts' } | { kind: 'pick'; color: Color; first?: FirstMove } | { kind: 'move'; keys: string[] } | null;

const FIRSTS: Record<string, FirstMove> = { e2e4: 'e4', d2d4: 'd4', c2c4: 'c4', g1f3: 'Nf3', b1c3: 'Nc3' };
const ORDER = ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'b1c3'];
const DRAG = 'application/x-mainline-items';

const folderItem = (f: Folder): Item => ({ key: `f:${f.id}`, type: 'folder', folder: f, color: f.color });
const repItem = (r: Repertoire): Item => ({ key: `r:${r.id}`, type: 'rep', rep: r, color: r.color });
const itemName = (it: Item) => (it.type === 'folder' ? t(it.folder.name) : it.rep.name);

function byFirstMove(a: Folder, b: Folder) {
  const ia = ORDER.indexOf(a.rootMovesUci?.[0] ?? '');
  const ib = ORDER.indexOf(b.rootMovesUci?.[0] ?? '');
  return (a.rootMovesUci?.length ?? 9) - (b.rootMovesUci?.length ?? 9) || (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.sortIndex - b.sortIndex;
}

/** Where a folder sits in the opening tree, from the position it stands for. */
function folderLevel(moves: string[]): { first?: FirstMove; reply?: string } {
  const first = FIRSTS[moves[0] ?? ''];
  if (!first) return {};
  return { first, reply: moves.length >= 2 ? replySan(first, moves[1]!) : undefined };
}

/**
 * The repertoire as a Finder: White and Black, then first moves, openings, systems and lines, nested as deep as
 * you like. Select (click, ⌘/⇧-click, arrows), open (double-click, ⌘O), rename (Enter), drag anything onto any
 * folder — in the list, the sidebar or the path bar — and right-click for everything else. On phones a tap opens
 * and a long press starts selecting.
 */
export function LibraryScreen() {
  const lib = useLibrary();
  const cards = useTraining((s) => s.cards);
  const games = useGames((g) => g.games);
  const nav = useNavigate();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useSearchParams();
  const folderId = params.get('f');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; keys: string[] } | null>(null);

  useEffect(() => {
    void lib.load().then(() => tidyPackLines());
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
  const roots = useMemo(() => folders.filter((f) => f.parentId === null).sort((a, b) => (a.color === 'white' ? -1 : 1) - (b.color === 'white' ? -1 : 1)), [folders]);
  // Ready-made systems side by side (the Vienna and the Spanish against 1…e5) differ on purpose: only your own lines warn.
  const conflicts = useMemo(() => {
    const ready = new Set(reps.filter(isReadyMade).map((r) => r.id));
    return findConflicts(reps, lib.moves).filter((c) => [...c.choices.values()].flat().some((id) => !ready.has(id)));
  }, [lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const records = useMemo(() => openingRecords(games), [games]);
  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;

  const itemsIn = useCallback(
    (parentId: string): Item[] => [
      ...folders.filter((f) => f.parentId === parentId).sort(byFirstMove).map(folderItem),
      ...reps.filter((r) => r.folderId === parentId).sort((a, b) => Number(isReadyMade(b)) - Number(isReadyMade(a)) || a.sortIndex - b.sortIndex).map(repItem),
    ],
    [folders, reps],
  );
  // What's on screen, in order: arrows and ⇧-click walk this.
  const visible = useMemo(() => (folder && folder.parentId !== null ? itemsIn(folder.id) : roots.flatMap((r) => (folder && folder.id !== r.id ? [] : itemsIn(r.id)))), [folder, roots, itemsIn]);
  const byKey = useMemo(() => new Map([...folders.map(folderItem), ...reps.map(repItem)].map((i) => [i.key, i])), [folders, reps]);

  // A new place starts with nothing selected.
  useEffect(() => {
    setSelected([]);
    setSelecting(false);
    setRenaming(null);
  }, [folderId]);

  const open = (it: Item) => (it.type === 'folder' ? nav(`/library?f=${it.folder.id}`) : nav(`/rep/${it.rep.id}`));
  const parentHref = (f?: Folder) => {
    const p = f && folders.find((x) => x.id === f.parentId);
    return p && p.parentId !== null ? `/library?f=${p.id}` : '/library';
  };

  /** Moves items into a folder: never into themselves, never across colours. Undo puts them back. */
  const moveKeys = async (keys: string[], targetId: string) => {
    const target = folders.find((f) => f.id === targetId);
    if (!target) return;
    const undo: (() => Promise<void>)[] = [];
    let blocked = 0;
    let moved = 0;
    for (const k of keys) {
      const it = byKey.get(k);
      if (!it) continue;
      if (it.color !== target.color) {
        blocked++;
        continue;
      }
      if (it.type === 'folder') {
        const f = it.folder;
        if (f.parentId === null || f.id === targetId || f.parentId === targetId || descendants(folders, f.id).includes(targetId)) continue;
        const was = f.parentId;
        await lib.moveFolder(f.id, targetId);
        undo.push(() => lib.moveFolder(f.id, was));
      } else {
        const r = it.rep;
        if (r.folderId === targetId) continue;
        const was = r.folderId;
        await lib.moveRepertoire(r.id, targetId);
        undo.push(() => lib.moveRepertoire(r.id, was));
      }
      moved++;
    }
    if (blocked) toast(t('White and Black keep separate folders.'), { kind: 'error' });
    if (moved) undoToast(tn(moved, 'Moved {n} item to {name}', 'Moved {n} items to {name}', { name: target.parentId === null ? (target.color === 'white' ? t('As White') : t('As Black')) : t(target.name) }), async () => {
      for (const u of undo.reverse()) await u();
    });
    setSelected([]);
  };

  const deleteKeys = async (keys: string[]) => {
    const undo: (() => Promise<void>)[] = [];
    for (const k of keys) {
      const it = byKey.get(k);
      if (!it) continue;
      if (it.type === 'folder' && it.folder.parentId !== null) undo.push(await lib.deleteFolder(it.folder.id));
      if (it.type === 'rep') undo.push(await lib.deleteRepertoire(it.rep.id));
    }
    if (!undo.length) return;
    undoToast(keys.length === 1 ? t('Deleted “{name}”', { name: itemName(byKey.get(keys[0]!)!) }) : tn(undo.length, 'Deleted {n} item', 'Deleted {n} items'), async () => {
      for (const u of undo) await u();
    });
    setSelected([]);
    setSelecting(false);
  };

  /** One folder or line practises as itself; a mixed selection practises every line in it. */
  const scopeOf = (keys: string[]): Scope | undefined => {
    const its = keys.map((k) => byKey.get(k)).filter(Boolean) as Item[];
    if (its.length === 1) return its[0]!.type === 'folder' ? (its[0]!.folder.parentId === null ? { kind: 'color', color: its[0]!.color } : { kind: 'folder', id: its[0]!.folder.id }) : { kind: 'rep', id: its[0]!.rep.id };
    const ids = new Set<string>();
    for (const it of its) for (const r of it.type === 'rep' ? [it.rep] : repsUnder(folders, reps, it.folder.id)) ids.add(r.id);
    return ids.size ? { kind: 'rep', id: [...ids].join(',') } : undefined;
  };
  const planHref = (scope: Scope, label: string) => `/plan?new=1&scope=${encodeURIComponent(JSON.stringify(scope))}&label=${encodeURIComponent(label)}`;

  /** Folders are the one container: each stands for a position, and holds lines and folders of its own. */
  const newFolder = (parent?: Folder) => setSheet({ kind: 'new-folder', folderId: parent?.id ?? null, color: parent?.color ?? 'white' });
  const here = folder ?? roots[0];

  /** A new, empty line in a folder, starting from the position the folder stands for; it opens to be played. */
  const newLine = async (folderId: string) => {
    const f = folders.find((x) => x.id === folderId);
    if (!f) return;
    const n = reps.filter((r) => r.folderId === f.id).length + 1;
    const rep = await lib.createRepertoire({ name: t('Line {n}', { n }), color: f.color, folderId: f.id, rootMovesUci: folderMoves(folders, reps, f.id) });
    nav(`/rep/${rep.id}?guide=1`);
  };

  // Selection by click: plain replaces, ⌘ toggles, ⇧ extends from the anchor.
  const select = (key: string, e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => {
    if (e.shiftKey && anchor.current) {
      const a = visible.findIndex((i) => i.key === anchor.current);
      const b = visible.findIndex((i) => i.key === key);
      if (a >= 0 && b >= 0) return setSelected(visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.key));
    }
    anchor.current = key;
    if (e.metaKey || e.ctrlKey || selecting) setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
    else setSelected([key]);
  };

  // Finder's keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (sheet || renaming || menu || (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) || document.querySelector('[role="dialog"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const idx = visible.findIndex((i) => i.key === selected.at(-1));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (mod && e.key === 'ArrowDown' && selected.length === 1) return open(byKey.get(selected[0]!)!);
        if (mod && e.key === 'ArrowUp') return nav(parentHref(folder));
        e.preventDefault();
        const next = visible[Math.max(0, Math.min(visible.length - 1, idx < 0 ? 0 : idx + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (!next) return;
        if (e.shiftKey) setSelected((s) => (s.includes(next.key) ? s : [...s, next.key]));
        else {
          setSelected([next.key]);
          anchor.current = next.key;
        }
        document.getElementById(`item-${next.key}`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && selected.length === 1) {
        e.preventDefault();
        if (wide && !mod) setRenaming(selected[0]!);
        else open(byKey.get(selected[0]!)!);
      } else if (mod && e.key.toLowerCase() === 'o' && selected.length === 1) {
        e.preventDefault();
        open(byKey.get(selected[0]!)!);
      } else if ((mod && e.key === 'Backspace') || e.key === 'Delete') {
        if (!selected.length) return;
        e.preventDefault();
        void deleteKeys(selected);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(visible.map((i) => i.key));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newFolder(folder ?? undefined);
      } else if (e.key === 'Escape') {
        setSelected([]);
        setSelecting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const menuFor = (keys: string[]): (MenuItem | 'sep')[] => {
    const its = keys.map((k) => byKey.get(k)).filter(Boolean) as Item[];
    const one = its.length === 1 ? its[0] : undefined;
    const scope = scopeOf(keys);
    const out: (MenuItem | 'sep')[] = [];
    if (one) out.push({ label: t('Open'), icon: ExternalLink, onSelect: () => open(one) });
    if (scope) {
      out.push({ label: t('Show me'), icon: Eye, onSelect: () => nav(practiceHref(scope, 'show')) });
      out.push({ label: t('Test me'), icon: Target, onSelect: () => nav(practiceHref(scope, 'test')) });
      out.push({ label: t('Make a plan…'), icon: CalendarDays, onSelect: () => nav(planHref(scope, one ? itemName(one) : tn(its.length, '{n} item', '{n} items'))) });
    }
    out.push('sep');
    if (one?.type === 'folder') {
      out.push({ label: t('New line inside'), icon: ListPlus, onSelect: () => void newLine(one.folder.id) });
      out.push({ label: t('New folder inside…'), icon: FolderPlus, onSelect: () => newFolder(one.folder) });
    }
    if (one && !(one.type === 'folder' && one.folder.parentId === null)) out.push({ label: t('Rename'), icon: Pencil, onSelect: () => setRenaming(one.key) });
    if (one?.type === 'folder' && one.folder.parentId !== null) out.push({ label: t('Folder settings…'), icon: Settings2, onSelect: () => setSheet({ kind: 'folder-settings', id: one.folder.id }) });
    if (its.some((i) => !(i.type === 'folder' && i.folder.parentId === null))) out.push({ label: its.length > 1 ? tn(its.length, 'Move {n} item to…', 'Move {n} items to…') : t('Move to…'), icon: FolderInput, onSelect: () => setSheet({ kind: 'move', keys }) });
    if (one?.type === 'rep') {
      if (!isReadyMade(one.rep)) out.push({ label: t('Import PGN into this'), icon: FileUp, onSelect: () => setSheet({ kind: 'import', repId: one.rep.id }) });
      out.push({
        label: t('Export PGN'),
        icon: Download,
        onSelect: async () => {
          await platform().share({ title: one.rep.name, file: { name: `${slug(one.rep.name)}.pgn`, content: lib.exportPgn(one.rep.id) } });
          toast(t('PGN exported'), { kind: 'success' });
        },
      });
    }
    if (its.some((i) => !(i.type === 'folder' && i.folder.parentId === null))) {
      out.push('sep');
      out.push({ label: its.length > 1 ? tn(its.length, 'Delete {n} item', 'Delete {n} items') : t('Delete'), icon: Trash2, danger: true, onSelect: () => void deleteKeys(keys) });
    }
    return out.filter((x, i, a) => !(x === 'sep' && (i === 0 || a[i - 1] === 'sep' || i === a.length - 1)));
  };

  const finder: FinderCtx = {
    wide,
    selected,
    selecting,
    renaming,
    cards,
    records,
    folders,
    reps,
    moves: lib.moves,
    onItemClick: (it, e) => {
      if (!wide && !selecting) return open(it);
      select(it.key, e);
    },
    onItemOpen: open,
    onLongPress: (it) => {
      setSelecting(true);
      setSelected([it.key]);
      anchor.current = it.key;
    },
    onContext: (it, x, y) => {
      const keys = selected.includes(it.key) ? selected : [it.key];
      setSelected(keys);
      setMenu({ x, y, keys });
    },
    dragKeys: (it) => {
      const keys = selected.includes(it.key) ? selected : [it.key];
      setSelected(keys);
      return keys;
    },
    drop: (keys, folderId) => void moveKeys(keys, folderId),
    rename: async (it, name) => {
      setRenaming(null);
      if (!name.trim()) return;
      if (it.type === 'folder') await lib.renameFolder(it.folder.id, name);
      else await lib.renameRepertoire(it.rep.id, name);
    },
    cancelRename: () => setRenaming(null),
  };

  const selectionBar = (selecting || selected.length > 1) && (
    <div className="sticky bottom-[calc(var(--tabbar-h,0px)+12px)] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-l)] bg-surface p-2.5 shadow-3 ring-1 ring-line/60 lg:bottom-4">
      <span className="tnum px-1.5 text-sm font-semibold">{tn(selected.length, '{n} selected', '{n} selected')}</span>
      <span className="flex-1" />
      {(() => {
        const scope = scopeOf(selected);
        return scope ? (
          <>
            <Link to={practiceHref(scope, 'show')} className="inline-flex min-h-10 py-1 items-center gap-1.5 rounded-[var(--radius-s)] bg-brand-soft px-3 text-sm font-semibold text-brand-ink hover:bg-brand-soft-2">
              <Eye size={15} aria-hidden /> {t('Show me')}
            </Link>
            <Link to={practiceHref(scope, 'test')} className="inline-flex min-h-10 py-1 items-center gap-1.5 rounded-[var(--radius-s)] bg-brand px-3 text-sm font-semibold text-on-brand">
              <Target size={15} aria-hidden /> {t('Test me')}
            </Link>
          </>
        ) : null;
      })()}
      <IconButton icon={FolderInput} label={t('Move to…')} size={36} disabled={!selected.length} onClick={() => setSheet({ kind: 'move', keys: selected })} />
      <IconButton icon={Trash2} label={t('Delete')} size={36} disabled={!selected.length} onClick={() => void deleteKeys(selected)} className="text-bad-ink" />
      <IconButton
        icon={X}
        label={t('Done')}
        size={36}
        onClick={() => {
          setSelected([]);
          setSelecting(false);
        }}
      />
    </div>
  );

  // Deleting the folder you're in takes you up to its parent; undo brings it back.
  const deleteFromSettings = async (id: string) => {
    const f = folders.find((x) => x.id === id);
    if (!f) return;
    setSheet(null);
    if (folder && (folder.id === id || descendants(folders, id).includes(folder.id))) nav(parentHref(f));
    const restore = await lib.deleteFolder(id);
    undoToast(t('Deleted “{name}”', { name: t(f.name) }), restore);
  };

  const moveColor = sheet?.kind === 'move' ? byKey.get(sheet.keys[0]!)?.color ?? 'white' : 'white';
  const sheets = (
    <>
      <NewFolderSheet open={sheet?.kind === 'new-folder'} initial={sheet?.kind === 'new-folder' ? sheet : undefined} onClose={() => setSheet(null)} />
      <FolderSettingsSheet folderId={sheet?.kind === 'folder-settings' ? sheet.id : null} onClose={() => setSheet(null)} onDelete={(id) => void deleteFromSettings(id)} />
      <ImportPgnSheet open={sheet?.kind === 'import'} repId={sheet?.kind === 'import' ? sheet.repId : undefined} initialText={sheet?.kind === 'import' ? sheet.text : undefined} onClose={() => setSheet(null)} />
      <ConflictsSheet open={sheet?.kind === 'conflicts'} conflicts={conflicts} onClose={() => setSheet(null)} />
      <OpeningPickerSheet open={sheet?.kind === 'pick'} color={sheet?.kind === 'pick' ? sheet.color : 'white'} first={sheet?.kind === 'pick' ? sheet.first : undefined} onClose={() => setSheet(null)} />
      <MoveSheet
        open={sheet?.kind === 'move'}
        color={moveColor}
        count={sheet?.kind === 'move' ? sheet.keys.length : 0}
        current={sheet?.kind === 'move' && sheet.keys.length === 1 ? (byKey.get(sheet.keys[0]!) as Item | undefined)?.type === 'rep' ? (byKey.get(sheet.keys[0]!) as Extract<Item, { type: 'rep' }>).rep.folderId : (byKey.get(sheet.keys[0]!) as Extract<Item, { type: 'folder' }> | undefined)?.folder.parentId : undefined}
        exclude={new Set(sheet?.kind === 'move' ? sheet.keys.filter((k) => k.startsWith('f:')).flatMap((k) => [k.slice(2), ...descendants(folders, k.slice(2))]) : [])}
        onPick={(id) => sheet?.kind === 'move' && void moveKeys(sheet.keys, id)}
        onClose={() => setSheet(null)}
      />
      <ContextMenu at={menu} items={menu ? menuFor(menu.keys) : []} label={t('Actions')} onClose={() => setMenu(null)} />
    </>
  );

  const toolbarNew = (parent?: Folder) => (
    <Menu
      label={t('New')}
      items={[
        ...(parent ? [{ label: t('New line'), icon: ListPlus, onSelect: () => void newLine(parent.id) }] : []),
        { label: t('New folder…'), icon: FolderPlus, onSelect: () => newFolder(parent) },
        { label: t('Ready-made openings'), icon: Sparkles, onSelect: () => nav('/library/ready') },
        { label: t('Browse openings by name'), icon: Search, onSelect: () => nav('/library/openings') },
        { label: t('Import PGN'), icon: FileUp, onSelect: () => setSheet({ kind: 'import' }) },
      ]}
      trigger={(p) => (
        <Button variant="primary" icon={Plus} {...p}>
          {t('New')}
        </Button>
      )}
    />
  );

  const main = folder && folder.parentId !== null ? (
    <FolderView folder={folder} finder={finder} items={itemsIn(folder.id)} setSheet={setSheet} newFolder={newFolder} planHref={planHref} parentHref={parentHref(folder)} wide={wide} toolbarNew={toolbarNew(folder)} />
  ) : (
    <RootView roots={folder ? [folder] : roots} finder={finder} itemsIn={itemsIn} conflicts={conflicts.length} setSheet={setSheet} toolbarNew={toolbarNew(folder)} planHref={planHref} />
  );

  if (!wide)
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10" onContextMenu={(e) => e.target === e.currentTarget && e.preventDefault()}>
        {main}
        {selectionBar}
        {!selecting && visible.length > 1 && (
          <button type="button" onClick={() => setSelecting(true)} className="pressable mt-4 inline-flex min-h-11 py-1 items-center gap-2 rounded-[var(--radius-control)] px-3 text-base font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
            <CheckSquare size={16} aria-hidden /> {t('Select')}
          </button>
        )}
        {sheets}
      </div>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px]">
      <Sidebar roots={roots} folders={folders} current={folder?.id} drop={finder.drop} />
      <div
        className="min-w-0 flex-1 px-8 py-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected([]);
        }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget || !here) return;
          e.preventDefault();
          setSelected([]);
          setMenu({ x: e.clientX, y: e.clientY, keys: [] });
        }}
      >
        <div className="mb-4 flex items-center gap-1">
          <IconButton icon={ArrowLeft} label={t('Back')} size={36} onClick={() => nav(-1)} />
          <IconButton icon={ArrowRight} label={t('Forward')} size={36} onClick={() => nav(1)} />
          <PathBar folder={folder} folders={folders} drop={finder.drop} />
        </div>
        {main}
        {selectionBar}
      </div>
      {sheets}
    </div>
  );
}

/* ---------------- Shared row machinery ---------------- */

interface FinderCtx {
  wide: boolean;
  selected: string[];
  selecting: boolean;
  renaming: string | null;
  cards: ReturnType<typeof useTraining.getState>['cards'];
  records: OpeningRecord[];
  folders: Folder[];
  reps: Repertoire[];
  moves: ReturnType<typeof useLibrary.getState>['moves'];
  onItemClick: (it: Item, e: React.MouseEvent) => void;
  onItemOpen: (it: Item) => void;
  onLongPress: (it: Item) => void;
  onContext: (it: Item, x: number, y: number) => void;
  dragKeys: (it: Item) => string[];
  drop: (keys: string[], folderId: string) => void;
  rename: (it: Item, name: string) => Promise<void>;
  cancelRename: () => void;
}

/** Any folder (in the list, the sidebar or the path bar) takes dragged items. */
function useDrop(folderId: string | undefined, drop: (keys: string[], folderId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: folderId
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes(DRAG)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOver(true);
          },
          onDragLeave: () => setOver(false),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOver(false);
            const keys = JSON.parse(e.dataTransfer.getData(DRAG) || '[]') as string[];
            if (keys.length) drop(keys, folderId);
          },
        }
      : {},
  };
}

function FinderList({ items, finder, label, empty }: { items: Item[]; finder: FinderCtx; label: string; empty?: React.ReactNode }) {
  if (!items.length) return <>{empty}</>;
  return (
    <ul role="listbox" aria-label={label} aria-multiselectable className={`${CARD} divide-y divide-line overflow-hidden`}>
      {items.map((it) => (
        <FinderRow key={it.key} it={it} finder={finder} />
      ))}
    </ul>
  );
}

function FinderRow({ it, finder }: { it: Item; finder: FinderCtx }) {
  const selected = finder.selected.includes(it.key);
  const { over, props: dropProps } = useDrop(it.type === 'folder' ? it.folder.id : undefined, finder.drop);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const name = itemName(it);
  const renaming = finder.renaming === it.key;

  const meta = useMemo(() => {
    if (it.type === 'rep') return null;
    const inside = repsUnder(finder.folders, finder.reps, it.folder.id);
    const progress = scopeProgress(inside, finder.moves, finder.cards);
    const at = it.folder.rootMovesUci ?? [];
    const { first, reply } = folderLevel(at);
    const rec = first && reply && at.length === 2 ? recordFor(finder.records, it.folder.color, first, reply) : undefined;
    const subs = finder.folders.filter((f) => f.parentId === it.folder.id).length;
    const lines = finder.reps.filter((r) => r.folderId === it.folder.id).length;
    return { progress, rec, subs, lines };
  }, [it, finder.folders, finder.reps, finder.moves, finder.cards, finder.records]);
  const preview = useMemo(() => (it.type === 'rep' ? repPreview(finder.moves, it.rep) : null), [it, finder.moves]);

  return (
    <li
      id={`item-${it.key}`}
      role="option"
      aria-selected={selected}
      aria-label={name}
      draggable={finder.wide && !renaming}
      tabIndex={-1}
      {...dropProps}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG, JSON.stringify(finder.dragKeys(it)));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        if (press.current?.fired) return;
        finder.onItemClick(it, e);
      }}
      onDoubleClick={() => finder.wide && finder.onItemOpen(it)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (press.current?.fired) return;
        finder.onContext(it, e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        const x = e.clientX;
        const y = e.clientY;
        press.current = { x, y, fired: false, timer: window.setTimeout(() => {
          if (press.current) press.current.fired = true;
          navigator.vibrate?.(10);
          finder.onLongPress(it);
        }, 450) };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
          clearTimeout(p.timer);
          press.current = null;
        }
      }}
      onPointerUp={() => {
        const p = press.current;
        if (p) clearTimeout(p.timer);
        // Let the click that follows a long press see `fired`, then forget it.
        setTimeout(() => (press.current = null), 0);
      }}
      className={`pressable flex min-h-[64px] cursor-default select-none items-center gap-3.5 px-4 py-2.5 ${over ? 'bg-brand-soft ring-2 ring-brand ring-inset' : selected ? 'bg-brand-softer' : 'hover:bg-surface-2 active:bg-surface-3'}`}
    >
      {finder.selecting && <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brand bg-brand text-on-brand' : 'border-line-strong'}`}>{selected && '✓'}</span>}
      {it.type === 'folder' ? (
        <FolderIcon size={22} className="shrink-0 text-brand" fill={selected ? 'currentColor' : 'none'} fillOpacity={0.15} aria-hidden />
      ) : (
        <MiniBoard fen={preview!.epd} lastMove={preview!.lastUci} orientation={it.rep.color} size={finder.wide ? 44 : 52} className="rounded-[6px]" decorative />
      )}
      <span className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            defaultValue={name}
            aria-label={t('Rename')}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={(e) => void finder.rename(it, e.currentTarget.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') finder.cancelRename();
            }}
            className="w-full rounded-[6px] border border-brand bg-surface px-1.5 py-0.5 font-semibold outline-none"
          />
        ) : (
          <span className="block text-md font-semibold">{name}</span>
        )}
        {it.type === 'folder' ? (
          <span className="tnum block text-sm text-ink-2">
            {meta!.subs > 0 && `${tn(meta!.subs, '{n} folder', '{n} folders')} · `}
            {meta!.lines > 0 && `${tn(meta!.lines, '{n} line', '{n} lines')} · `}
            <ProgressText p={meta!.progress} />
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-sm text-ink-2">
              {isReadyMade(it.rep) ? <Sparkles size={13} aria-hidden /> : <Hammer size={13} aria-hidden />}
              {isReadyMade(it.rep) ? t('Ready-made') : t('Your line')}
            </span>
            <MasteryStrip rep={it.rep} moves={repMoves(finder.moves, it.rep.id)} cards={finder.cards} now={Date.now()} />
          </>
        )}
      </span>
      {meta?.rec && <RecordBadge rec={meta.rec} />}
      {!finder.wide && !finder.selecting && <ChevronRight size={18} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />}
      {finder.wide && (
        <button
          type="button"
          aria-label={t('{name} actions', { name })}
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            finder.onContext(it, r.left, r.bottom + 4);
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
        >
          ⋯
        </button>
      )}
    </li>
  );
}

/* ---------------- Sidebar and path bar (wide screens) ---------------- */

function Sidebar({ roots, folders, current, drop }: { roots: Folder[]; folders: Folder[]; current?: string; drop: (keys: string[], folderId: string) => void }) {
  const ancestors = useMemo(() => {
    const out = new Set<string>();
    let f = folders.find((x) => x.id === current);
    while (f) {
      out.add(f.id);
      f = folders.find((x) => x.id === f!.parentId);
    }
    return out;
  }, [folders, current]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(JSON.parse(sessionStorageGet('ml.sidebar') ?? '[]') as string[]));
  useEffect(() => sessionStorageSet('ml.sidebar', JSON.stringify([...expanded])), [expanded]);
  const node = (f: Folder, depth: number): React.ReactNode => {
    const kids = folders.filter((x) => x.parentId === f.id).sort(byFirstMove);
    const isOpen = depth === 0 || expanded.has(f.id) || (ancestors.has(f.id) && f.id !== current);
    return <SidebarNode key={f.id} f={f} depth={depth} kids={kids} isOpen={isOpen} active={f.id === current || (!current && false)} toggle={() => setExpanded((s) => new Set(s.has(f.id) ? [...s].filter((x) => x !== f.id) : [...s, f.id]))} drop={drop} render={node} />;
  };
  return (
    <nav aria-label={t('Folders')} className="sticky top-0 hidden h-dvh w-[260px] shrink-0 overflow-y-auto border-e border-line px-2 py-6 lg:block">
      <Link to="/library" className="mb-3 flex items-center gap-2 px-2 text-xl font-bold">
        {t('Repertoire')}
      </Link>
      {roots.map((r) => (
        <ul key={r.id} className="mb-3">
          {node(r, 0)}
        </ul>
      ))}
      <div className="mt-4 flex flex-col gap-0.5 border-t border-line pt-3">
        <Link to="/focus" className="flex min-h-10 py-1 items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <Target size={16} aria-hidden /> {t('Weak spots')}
        </Link>
        <Link to="/plan" className="flex min-h-10 py-1 items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <CalendarDays size={16} aria-hidden /> {t('Study plan')}
        </Link>
        <Link to="/library/ready" className="flex min-h-10 py-1 items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <Sparkles size={16} aria-hidden /> {t('Ready-made openings')}
        </Link>
        <Link to="/stats" className="flex min-h-10 py-1 items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          <BarChart3 size={16} aria-hidden /> {t('Statistics')}
        </Link>
      </div>
    </nav>
  );
}

function SidebarNode({ f, depth, kids, isOpen, active, toggle, drop, render }: { f: Folder; depth: number; kids: Folder[]; isOpen: boolean; active: boolean; toggle: () => void; drop: (keys: string[], folderId: string) => void; render: (f: Folder, depth: number) => React.ReactNode }) {
  const { over, props } = useDrop(f.id, drop);
  return (
    <li>
      <div {...props} className={`flex h-9 items-center rounded-[var(--radius-xs)] ${over ? 'bg-brand-soft ring-2 ring-brand ring-inset' : active ? 'bg-surface-3' : 'hover:bg-surface-2'}`} style={{ paddingInlineStart: depth * 14 }}>
        <button type="button" onClick={toggle} disabled={!kids.length || depth === 0} aria-label={isOpen ? t('Collapse') : t('Expand')} className="flex size-6 shrink-0 items-center justify-center text-ink-3 disabled:opacity-0">
          <ChevronRight size={13} className={`transition-transform ${isOpen ? 'rotate-90' : 'rtl:rotate-180'}`} aria-hidden />
        </button>
        <Link to={f.parentId === null ? `/library?f=${f.id}` : `/library?f=${f.id}`} className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm ${depth === 0 ? 'font-bold' : 'font-medium'}`}>
          {depth === 0 ? <ColorDot color={f.color} size="sm" /> : <FolderIcon size={14} className="shrink-0 text-brand" aria-hidden />}
          <span className="min-w-0 break-words">{depth === 0 ? (f.color === 'white' ? t('As White') : t('As Black')) : t(f.name)}</span>
        </Link>
      </div>
      {isOpen && kids.length > 0 && <ul>{kids.map((k) => render(k, depth + 1))}</ul>}
    </li>
  );
}

function PathBar({ folder, folders, drop }: { folder?: Folder; folders: Folder[]; drop: (keys: string[], folderId: string) => void }) {
  const trail: Folder[] = [];
  let cur = folder;
  while (cur) {
    trail.unshift(cur);
    cur = folders.find((f) => f.id === cur!.parentId);
  }
  return (
    <nav aria-label={t('Breadcrumb')} className="ms-2 flex min-w-0 items-center gap-0.5 text-sm text-ink-2">
      <Link to="/library" className="rounded-[6px] px-1.5 py-1 hover:bg-surface-3 hover:text-ink">
        {t('Repertoire')}
      </Link>
      {trail.map((f) => (
        <Crumb key={f.id} f={f} drop={drop} />
      ))}
    </nav>
  );
}

function Crumb({ f, drop }: { f: Folder; drop: (keys: string[], folderId: string) => void }) {
  const { over, props } = useDrop(f.id, drop);
  return (
    <span className="flex min-w-0 items-center" {...props}>
      <ChevronRight size={14} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
      <Link to={`/library?f=${f.id}`} className={`truncate rounded-[6px] px-1.5 py-1 hover:bg-surface-3 hover:text-ink ${over ? 'bg-brand-soft ring-2 ring-brand' : ''}`}>
        {f.parentId === null ? (f.color === 'white' ? t('As White') : t('As Black')) : t(f.name)}
      </Link>
    </span>
  );
}

const sessionStorageGet = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const sessionStorageSet = (k: string, v: string) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* not kept */
  }
};

/* ---------------- Views ---------------- */

function RootView({ roots, finder, itemsIn, conflicts, setSheet, toolbarNew, planHref }: { roots: Folder[]; finder: FinderCtx; itemsIn: (id: string) => Item[]; conflicts: number; setSheet: (s: SheetState) => void; toolbarNew: React.ReactNode; planHref: (s: Scope, label: string) => string }) {
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

function ColorSection({ root, finder, items, setSheet, single, planHref }: { root: Folder; finder: FinderCtx; items: Item[]; setSheet: (s: SheetState) => void; single: boolean; planHref: (s: Scope, label: string) => string }) {
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

function FolderView({ folder, finder, items, setSheet, newFolder, planHref, parentHref, wide, toolbarNew }: { folder: Folder; finder: FinderCtx; items: Item[]; setSheet: (s: SheetState) => void; newFolder: (parent?: Folder) => void; planHref: (s: Scope, label: string) => string; parentHref: string; wide: boolean; toolbarNew: React.ReactNode }) {
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

function MobileTrail({ folder, folders }: { folder: Folder; folders: Folder[] }) {
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
function ColorDot({ color, size = 'md' }: { color: 'white' | 'black'; size?: 'sm' | 'md' }) {
  return <span className={`inline-block shrink-0 rounded-full ring-1 ring-line-strong ${size === 'sm' ? 'size-2.5' : 'size-3.5'} ${color === 'white' ? 'bg-chess-white' : 'bg-chess-black'}`} aria-hidden />;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repertoire';
