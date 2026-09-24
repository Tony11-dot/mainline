import { Folder as FolderIcon } from 'lucide-react';
import type { Folder, Repertoire } from '@mainline/shared';
import { descendants, folderPath, useLibrary } from '../../lib/library';
import { Sheet } from '../../ui/Sheet';

export function MoveToSheet({ open, item, onClose }: { open: boolean; item?: { type: 'folder'; folder: Folder } | { type: 'rep'; rep: Repertoire }; onClose: () => void }) {
  const lib = useLibrary();
  if (!item) return <Sheet open={false} onClose={onClose} title="Move to">{null}</Sheet>;
  const color = item.type === 'folder' ? item.folder.color : item.rep.color;
  const excluded = item.type === 'folder' ? new Set([item.folder.id, ...descendants(lib.folders, item.folder.id)]) : new Set<string>();
  const targets = lib.folders
    .filter((f) => !f.deleted && f.color === color && !excluded.has(f.id))
    .map((f) => ({ f, path: folderPath(lib.folders, f.id) }))
    .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  const current = item.type === 'folder' ? item.folder.parentId : item.rep.folderId;
  return (
    <Sheet open={open} onClose={onClose} title={`Move “${item.type === 'folder' ? item.folder.name : item.rep.name}”`}>
      <ul className="flex flex-col py-1">
        {targets.map(({ f, path }) => (
          <li key={f.id}>
            <button
              type="button"
              disabled={f.id === current}
              onClick={async () => {
                if (item.type === 'folder') await lib.moveFolder(item.folder.id, f.id);
                else await lib.moveRepertoire(item.rep.id, f.id);
                onClose();
              }}
              className="flex h-12 w-full items-center gap-3 rounded-[12px] px-2 text-left hover:bg-surface-3 disabled:opacity-40"
              style={{ paddingLeft: 8 + (path.length - 1) * 18 }}
            >
              <FolderIcon size={18} className="text-brand" aria-hidden />
              <span className="font-medium">{f.name}</span>
              {f.id === current && <span className="text-xs text-ink-3">current</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
