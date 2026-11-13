import { session } from '../../lib/storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BarChart3, CalendarDays, ChevronRight, Folder as FolderIcon, Hammer, Sparkles, Target } from 'lucide-react';
import { isReadyMade, type Folder } from '@mainline/shared';
import { repMoves, repPreview, repsUnder } from '../../lib/library';
import { recordFor } from '../../lib/packs';
import { MasteryStrip } from '../../ui/MasteryStrip';
import { MiniBoard } from '../../ui/MiniBoard';
import { CARD } from '../../ui/kit';
import { ProgressText, RecordBadge, scopeProgress } from './practiceUi';
import { t, tn } from '../../lib/i18n';
import { DRAG, byFirstMove, folderLevel, itemName, type FinderCtx, type Item } from './finderModel';

/** Any folder (in the list, the sidebar or the path bar) takes dragged items. */
export function useDrop(folderId: string | undefined, drop: (keys: string[], folderId: string) => void) {
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

export function FinderList({ items, finder, label, empty }: { items: Item[]; finder: FinderCtx; label: string; empty?: React.ReactNode }) {
  if (!items.length) return <>{empty}</>;
  return (
    <ul role="listbox" aria-label={label} aria-multiselectable className={`${CARD} divide-y divide-line overflow-hidden`}>
      {items.map((it) => (
        <FinderRow key={it.key} it={it} finder={finder} />
      ))}
    </ul>
  );
}

export function FinderRow({ it, finder }: { it: Item; finder: FinderCtx }) {
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

export function Sidebar({ roots, folders, current, drop }: { roots: Folder[]; folders: Folder[]; current?: string; drop: (keys: string[], folderId: string) => void }) {
  const ancestors = useMemo(() => {
    const out = new Set<string>();
    let f = folders.find((x) => x.id === current);
    while (f) {
      out.add(f.id);
      f = folders.find((x) => x.id === f!.parentId);
    }
    return out;
  }, [folders, current]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(session.getJson<string[]>('ml.sidebar') ?? []));
  useEffect(() => session.setJson('ml.sidebar', [...expanded]), [expanded]);
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

export function SidebarNode({ f, depth, kids, isOpen, active, toggle, drop, render }: { f: Folder; depth: number; kids: Folder[]; isOpen: boolean; active: boolean; toggle: () => void; drop: (keys: string[], folderId: string) => void; render: (f: Folder, depth: number) => React.ReactNode }) {
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

export function PathBar({ folder, folders, drop }: { folder?: Folder; folders: Folder[]; drop: (keys: string[], folderId: string) => void }) {
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

export function Crumb({ f, drop }: { f: Folder; drop: (keys: string[], folderId: string) => void }) {
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

export function ColorDot({ color, size = 'md' }: { color: 'white' | 'black'; size?: 'sm' | 'md' }) {
  return <span className={`inline-block shrink-0 rounded-full ring-1 ring-line-strong ${size === 'sm' ? 'size-2.5' : 'size-3.5'} ${color === 'white' ? 'bg-chess-white' : 'bg-chess-black'}`} aria-hidden />;
}

