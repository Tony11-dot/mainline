import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { INITIAL_FEN, playLine, toEpd, type Color } from '@mainline/shared';
import { useLibrary, folderMoves, folderPath } from '../../lib/library';
import { useOpeningsByEpd } from '../../board/useOpeningName';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { MiniBoard } from '../../ui/MiniBoard';
import { parseSanLine } from './sanLine';
import { t } from '../../lib/i18n';

/**
 * A folder is the only container: it stands for a position (its parent's, plus any moves you add here)
 * and holds lines and folders of its own, all starting from there. White › 1.e4 › e5 › Spanish › lines.
 */
export function NewFolderSheet({ open, initial, onClose }: { open: boolean; initial?: { folderId: string | null; color: Color }; onClose: () => void }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const names = useOpeningsByEpd();
  const [name, setName] = useState('');
  const [color, setColor] = useState<Color>('white');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [moves, setMoves] = useState('');
  useEffect(() => {
    if (!open || !initial) return;
    setName('');
    setColor(initial.color);
    setFolderId(initial.folderId);
    setMoves('');
  }, [open, initial]);

  const folders = lib.folders.filter((f) => !f.deleted && f.color === color);
  // Keep the parent consistent with the chosen colour.
  useEffect(() => {
    if (folderId && folders.some((f) => f.id === folderId)) return;
    setFolderId(folders.find((f) => f.parentId === null)?.id ?? null);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps
  const parent = folders.find((f) => f.id === folderId) ?? folders.find((f) => f.parentId === null);
  const before = useMemo(() => (parent ? folderMoves(lib.folders, lib.reps, parent.id) : []), [parent, lib.folders, lib.reps]);
  const beforeSan = useMemo(() => {
    try {
      return playLine(INITIAL_FEN, before).moves.map((m, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${m.san}`).join(' ');
    } catch {
      return '';
    }
  }, [before]);
  const parsed = useMemo(() => parseSanLine(moves, before), [moves, before]);
  const auto = (parsed.ucis.length && names?.get(toEpd(parsed.fen))?.name) || parsed.sans.join(' ') || t('New folder');

  const create = async () => {
    if (parsed.error || !parent) return;
    const f = await lib.createFolder(name.trim() || auto, color, parent.id, [...before, ...parsed.ucis]);
    onClose();
    nav(`/library?f=${f.id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('New folder')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={!!parsed.error}>
            {t('Create')}
          </Button>
        </>
      }
    >
      {initial?.folderId == null && (
        <Field label={t('I play')} group>
          <Segmented<Color> label={t('Colour')} value={color} onChange={setColor} options={[{ value: 'white', label: t('White') }, { value: 'black', label: t('Black') }]} />
        </Field>
      )}
      <Field label={t('Inside')}>
        <select className={inputCls} value={parent?.id ?? ''} onChange={(e) => setFolderId(e.target.value || null)}>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {folderPath(lib.folders, f.id).map((n) => t(n)).join(' / ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('Moves (optional)')} hint={t('The moves this folder adds, e.g. e5, then 2.Nf3 Nc6 3.Bb5 for a Spanish folder. Lines you make inside start from there.')}>
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {beforeSan && <p className="tnum mb-1 truncate text-xs text-ink-3" dir="ltr">{beforeSan} …</p>}
            <input className={`${inputCls} ${parsed.error ? 'border-bad' : ''}`} value={moves} onChange={(e) => setMoves(e.target.value)} placeholder={before.length ? 'Nf3' : '1.e4'} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-invalid={!!parsed.error} />
          </div>
          <MiniBoard fen={parsed.fen} size={72} orientation={color} />
        </div>
        {parsed.error && <span className="mt-1 block text-sm text-bad-ink">{parsed.error}</span>}
      </Field>
      <Field label={t('Name (optional)')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={auto} maxLength={80} />
      </Field>
    </Sheet>
  );
}
