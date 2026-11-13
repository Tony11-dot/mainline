import { type Color, type Folder, type Repertoire } from '@mainline/shared';
import { useLibrary } from '../../lib/library';
import { useTraining } from '../../lib/training';
import { FIRST_BY_UCI, FIRST_UCI_ORDER, replySan, type FirstMove, type OpeningRecord } from '../../lib/packs';
import { t } from '../../lib/i18n';

export type Item = { key: string; type: 'folder'; folder: Folder; color: Color } | { key: string; type: 'rep'; rep: Repertoire; color: Color };
export type SheetState = { kind: 'new-folder'; folderId: string | null; color: Color } | { kind: 'folder-settings'; id: string } | { kind: 'import'; repId?: string; text?: string } | { kind: 'conflicts' } | { kind: 'pick'; color: Color; first?: FirstMove } | { kind: 'move'; keys: string[] } | null;

export const DRAG = 'application/x-mainline-items';
export const folderItem = (f: Folder): Item => ({ key: `f:${f.id}`, type: 'folder', folder: f, color: f.color });
export const repItem = (r: Repertoire): Item => ({ key: `r:${r.id}`, type: 'rep', rep: r, color: r.color });
export const itemName = (it: Item) => (it.type === 'folder' ? t(it.folder.name) : it.rep.name);

export interface FinderCtx {
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


export function byFirstMove(a: Folder, b: Folder) {
  const ia = FIRST_UCI_ORDER.indexOf(a.rootMovesUci?.[0] ?? '');
  const ib = FIRST_UCI_ORDER.indexOf(b.rootMovesUci?.[0] ?? '');
  return (a.rootMovesUci?.length ?? 9) - (b.rootMovesUci?.length ?? 9) || (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.sortIndex - b.sortIndex;
}

/** Where a folder sits in the opening tree, from the position it stands for. */
export function folderLevel(moves: string[]): { first?: FirstMove; reply?: string } {
  const first = FIRST_BY_UCI[moves[0] ?? ''];
  if (!first) return {};
  return { first, reply: moves.length >= 2 ? replySan(first, moves[1]!) : undefined };
}

/**
 * The repertoire as a Finder: White and Black, then first moves, openings, systems and lines, nested as deep as
 * you like. Select (click, ⌘/⇧-click, arrows), open (double-click, ⌘O), rename (Enter), drag anything onto any
 * folder — in the list, the sidebar or the path bar — and right-click for everything else. On phones a tap opens
 * and a long press starts selecting.
 */
