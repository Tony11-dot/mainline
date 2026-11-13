import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, Download, ExternalLink, Eye, FileUp, FolderInput, FolderPlus, ListPlus, Pencil, Plus, Search, Settings2, Sparkles, Target, Trash2, X } from 'lucide-react';
import { findConflicts, isReadyMade, type Folder } from '@mainline/shared';
import { descendants, folderMoves, repsUnder, useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { useGames } from '../lib/games';
import { openingRecords, tidyPackLines } from '../lib/packs';
import { practiceHref, type Scope } from '../lib/practice';
import { platform } from '../platform';
import { Button, IconButton } from '../ui/primitives';
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
import { onPendingImport, readSharedFromServiceWorker, takePendingImport } from '../lib/incoming';
import { msg, t, tn } from '../lib/i18n';

// The default root folders are created as “White” and “Black”: shown in the app language.
msg('White');
msg('Black');

import { byFirstMove, itemName, folderItem, repItem, type FinderCtx, type Item, type SheetState } from './library/finderModel';
import { PathBar, Sidebar } from './library/Finder';
import { FolderView, RootView, slug } from './library/Views';

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

