import { useState } from 'react';
import { ChevronRight, Folder as FolderIcon } from 'lucide-react';
import type { Color, Folder } from '@mainline/shared';
import { useLibrary } from '../../lib/library';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../lib/i18n';

/** Pick a folder to move things into: the colour's folder tree, expandable, the way Finder's "Move to" works. */
export function MoveSheet({ open, color, exclude, current, count, onPick, onClose }: { open: boolean; color: Color; exclude: Set<string>; current?: string | null; count: number; onPick: (folderId: string) => void; onClose: () => void }) {
  const folders = useLibrary((s) => s.folders).filter((f) => !f.deleted && f.color === color);
  const root = folders.find((f) => f.parentId === null);
  // Everything starts expanded; you fold what you don't need.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const row = (f: Folder, depth: number): React.ReactNode => {
    if (exclude.has(f.id)) return null;
    const kids = folders.filter((x) => x.parentId === f.id).sort((a, b) => a.sortIndex - b.sortIndex);
    const isOpen = depth === 0 || !closed.has(f.id);
    return (
      <li key={f.id}>
        <div className="flex items-center" style={{ paddingInlineStart: depth * 18 }}>
          <button
            type="button"
            aria-label={isOpen ? t('Collapse') : t('Expand')}
            disabled={!kids.length || depth === 0}
            onClick={() => setClosed((s) => new Set(s.has(f.id) ? [...s].filter((x) => x !== f.id) : [...s, f.id]))}
            className="flex size-8 shrink-0 items-center justify-center text-ink-3 disabled:opacity-0"
          >
            <ChevronRight size={15} className={`transition-transform ${isOpen ? 'rotate-90' : 'rtl:rotate-180'}`} aria-hidden />
          </button>
          <button
            type="button"
            disabled={f.id === current}
            onClick={() => {
              onPick(f.id);
              onClose();
            }}
            className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2 text-start hover:bg-surface-3 disabled:opacity-40"
          >
            <FolderIcon size={18} className="shrink-0 text-brand" aria-hidden />
            <span className="truncate font-medium">{f.parentId === null ? (color === 'white' ? t('As White') : t('As Black')) : t(f.name)}</span>
            {f.id === current && <span className="text-xs text-ink-3">{t('current')}</span>}
          </button>
        </div>
        {isOpen && kids.length > 0 && <ul>{kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title={count === 1 ? t('Move to') : t('Move {n} items to', { n: count })}>
      <ul className="flex flex-col py-1">{root && row(root, 0)}</ul>
    </Sheet>
  );
}
