import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Color } from '@mainline/shared';
import { useLibrary, folderPath } from '../../lib/library';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { MiniBoard } from '../../ui/MiniBoard';
import { parseSanLine } from './sanLine';

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
    const rep = await lib.createRepertoire({ name: name || parsed.sans.join(' ') || `${color === 'white' ? 'White' : 'Black'} repertoire`, color, folderId, rootMovesUci: parsed.ucis });
    onClose();
    nav(`/rep/${rep.id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New repertoire"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={!!parsed.error}>
            Create & open
          </Button>
        </>
      }
    >
      <Field label="I play">
        <Segmented<Color> label="Colour" value={color} onChange={setColor} options={[{ value: 'white', label: 'White' }, { value: 'black', label: 'Black' }]} />
      </Field>
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={color === 'white' ? 'e.g. London System' : 'e.g. Najdorf'} maxLength={80} />
      </Field>
      <Field label="Folder">
        <select className={inputCls} value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value || null)}>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {folderPath(lib.folders, f.id).join(' / ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Starting moves (optional)" hint="The repertoire starts after these moves, e.g. 1.e4 c5 for a Sicilian.">
        <div className="flex gap-3">
          <input className={`${inputCls} ${parsed.error ? 'border-bad' : ''}`} value={moves} onChange={(e) => setMoves(e.target.value)} placeholder="1.e4 c5" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-invalid={!!parsed.error} />
          <MiniBoard fen={parsed.fen} size={64} orientation={color} />
        </div>
        {parsed.error && <span className="mt-1 block text-sm text-bad">{parsed.error}</span>}
      </Field>
    </Sheet>
  );
}
