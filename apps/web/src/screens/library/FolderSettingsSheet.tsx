import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { INITIAL_FEN, playLine } from '@mainline/shared';
import { useLibrary, descendants, folderMoves, folderPath, repsUnder } from '../../lib/library';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button } from '../../ui/primitives';
import { MiniBoard } from '../../ui/MiniBoard';
import { parseSanLine } from './sanLine';
import { t, tn } from '../../lib/i18n';

const sanOf = (ucis: string[], from: string[] = []) => {
  try {
    return playLine(INITIAL_FEN, [...from, ...ucis])
      .moves.map((m, i) => ({ m, i }))
      .slice(from.length)
      .map(({ m, i }) => `${i % 2 === 0 ? `${i / 2 + 1}.` : i === from.length ? `${Math.ceil(i / 2)}…` : ''}${m.san}`)
      .join(' ');
  } catch {
    return '';
  }
};

/**
 * A folder's settings: its name, where it lives, the moves it stands for (while nothing is built on them yet),
 * and deleting it.
 */
export function FolderSettingsSheet({ folderId, onClose, onDelete }: { folderId: string | null; onClose: () => void; onDelete: (id: string) => void }) {
  const lib = useLibrary();
  const folder = lib.folders.find((f) => f.id === folderId && !f.deleted);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [moves, setMoves] = useState('');

  const parent = lib.folders.find((f) => f.id === parentId);
  const before = useMemo(() => (parent ? folderMoves(lib.folders, lib.reps, parent.id) : []), [parent, lib.folders, lib.reps]);
  const own = useMemo(() => (folder ? folderMoves(lib.folders, lib.reps, folder.id) : []), [folder, lib.folders, lib.reps]);
  const lines = folder ? repsUnder(lib.folders, lib.reps, folder.id).length : 0;
  const subfolders = folder ? descendants(lib.folders, folder.id).length : 0;
  const movesFixed = lines > 0 || subfolders > 0;

  useEffect(() => {
    if (!folder) return;
    setName(t(folder.name));
    setParentId(folder.parentId);
    const p = folderMoves(lib.folders, lib.reps, folder.parentId ?? '');
    const shared = p.every((u, i) => own[i] === u);
    setMoves(sanOf(shared ? own.slice(p.length) : own, shared ? p : []));
  }, [folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => parseSanLine(moves, before), [moves, before]);
  if (!folder) return null;

  // Anywhere of the same colour except inside itself.
  const banned = new Set([folder.id, ...descendants(lib.folders, folder.id)]);
  const places = lib.folders.filter((f) => !f.deleted && f.color === folder.color && !banned.has(f.id));

  const save = async () => {
    if (!movesFixed && parsed.error) return;
    if (name.trim() && name.trim() !== t(folder.name)) await lib.renameFolder(folder.id, name);
    if (parentId && parentId !== folder.parentId) await lib.moveFolder(folder.id, parentId);
    if (!movesFixed) {
      const next = [...before, ...parsed.ucis];
      if (next.join(' ') !== own.join(' ')) await lib.setFolderMoves(folder.id, next);
    }
    onClose();
  };

  return (
    <Sheet
      open={!!folderId}
      onClose={onClose}
      title={t('Folder settings')}
      footer={
        <>
          <Button variant="ghost" icon={Trash2} className="me-auto text-bad hover:text-bad" onClick={() => onDelete(folder.id)}>
            {t('Delete')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!movesFixed && !!parsed.error}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <Field label={t('Name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Field label={t('Inside')}>
        <select className={inputCls} value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)}>
          {places.map((f) => (
            <option key={f.id} value={f.id}>
              {folderPath(lib.folders, f.id).map((n) => t(n)).join(' / ')}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={t('Moves')}
        hint={movesFixed ? t('Its lines and folders are built on these moves, so they stay as they are. To start from other moves, make a new folder.') : t('Lines you make inside start from here.')}
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {movesFixed ? (
              <p className="tnum rounded-[var(--radius-control)] bg-surface-2 px-3.5 py-2.5 text-sm" dir="ltr">
                {sanOf(own) || t('From the start')}
              </p>
            ) : (
              <>
                {before.length > 0 && (
                  <p className="tnum mb-1 truncate text-xs text-ink-3" dir="ltr">
                    {sanOf(before)} …
                  </p>
                )}
                <input className={`${inputCls} ${parsed.error ? 'border-bad' : ''}`} value={moves} onChange={(e) => setMoves(e.target.value)} placeholder={before.length ? 'Nf3' : '1.e4'} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={t('Moves')} aria-invalid={!!parsed.error} />
                {parsed.error && <span className="mt-1 block text-sm text-bad">{parsed.error}</span>}
              </>
            )}
          </div>
          <MiniBoard fen={movesFixed ? playFen(own) : parsed.fen} size={72} orientation={folder.color} />
        </div>
      </Field>
      <p className="text-sm text-ink-3">
        {tn(lines, '{n} line', '{n} lines')} · {tn(subfolders, '{n} folder', '{n} folders')}
      </p>
    </Sheet>
  );
}

function playFen(ucis: string[]) {
  try {
    return playLine(INITIAL_FEN, ucis).moves.at(-1)?.fen ?? INITIAL_FEN;
  } catch {
    return INITIAL_FEN;
  }
}
