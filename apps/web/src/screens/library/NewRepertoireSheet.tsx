import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Color } from '@mainline/shared';
import { useLibrary, folderPath } from '../../lib/library';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { MiniBoard } from '../../ui/MiniBoard';
import { parseSanLine } from './sanLine';
import { t } from '../../lib/i18n';

export function NewRepertoireSheet({ open, initial, onClose }: { open: boolean; initial?: { folderId: string | null; color: Color; name?: string; moves?: string }; onClose: () => void }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [color, setColor] = useState<Color>('white');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [moves, setMoves] = useState('');
  useEffect(() => {
    if (!open || !initial) return;
    setName(initial.name ?? '');
    setColor(initial.color);
    setFolderId(initial.folderId);
    setMoves(initial.moves ?? '');
  }, [open, initial]);

  const parsed = useMemo(() => parseSanLine(moves), [moves]);
  const folders = lib.folders.filter((f) => !f.deleted && f.color === color);
  // Keep the folder consistent with the chosen colour.
  useEffect(() => {
    if (folderId && folders.some((f) => f.id === folderId)) return;
    setFolderId(folders.find((f) => f.parentId === null)?.id ?? null);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (parsed.error) return;
    const rep = await lib.createRepertoire({ name: name || parsed.sans.join(' ') || (color === 'white' ? t('White repertoire') : t('Black repertoire')), color, folderId, rootMovesUci: parsed.ucis });
    onClose();
    nav(`/rep/${rep.id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('New repertoire')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={!!parsed.error}>
            {t('Create & open')}
          </Button>
        </>
      }
    >
      <Field label={t('I play')} group>
        <Segmented<Color> label={t('Colour')} value={color} onChange={setColor} options={[{ value: 'white', label: t('White') }, { value: 'black', label: t('Black') }]} />
      </Field>
      <Field label={t('Name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={color === 'white' ? t('e.g. London System') : t('e.g. Najdorf')} maxLength={80} />
      </Field>
      <Field label={t('Folder')}>
        <select className={inputCls} value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value || null)}>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {folderPath(lib.folders, f.id).map((n) => t(n)).join(' / ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('Starting moves (optional)')} hint={t('The repertoire starts after these moves, e.g. 1.e4 c5 for a Sicilian.')}>
        <div className="flex gap-3">
          <input className={`${inputCls} ${parsed.error ? 'border-bad' : ''}`} value={moves} onChange={(e) => setMoves(e.target.value)} placeholder="1.e4 c5" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-invalid={!!parsed.error} />
          <MiniBoard fen={parsed.fen} size={64} orientation={color} />
        </div>
        {parsed.error && <span className="mt-1 block text-sm text-bad">{parsed.error}</span>}
      </Field>
    </Sheet>
  );
}
