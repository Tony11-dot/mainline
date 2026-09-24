import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileUp } from 'lucide-react';
import type { Color } from '@mainline/shared';
import { useLibrary } from '../../lib/library';
import { platform } from '../../platform';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { toast } from '../../ui/toast';

/** Paste or open a PGN (variations and comments kept) into an existing or new repertoire. */
export function ImportPgnSheet({ open, repId, initialText, onClose }: { open: boolean; repId?: string; initialText?: string; onClose: () => void }) {
  const lib = useLibrary();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>('new');
  const [color, setColor] = useState<Color>('white');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTarget(repId ?? 'new');
    setText(initialText ?? '');
    const ev = initialText?.match(/\[Event "([^"]+)"\]/)?.[1];
    setName(ev && ev !== '?' ? ev : '');
  }, [open, repId, initialText]);

  const reps = lib.reps.filter((r) => !r.deleted);
  const run = async () => {
    setBusy(true);
    try {
      let id = target;
      if (target === 'new') {
        const root = lib.folders.find((f) => !f.deleted && f.parentId === null && f.color === color);
        const ev = text.match(/\[Event "([^"]+)"\]/)?.[1];
        const fallback = ev && ev !== '?' ? ev : 'Imported repertoire';
        id = (await lib.createRepertoire({ name: name || fallback, color, folderId: root?.id ?? null })).id;
      }
      const res = await lib.importPgn(id, text);
      if (res.errors.length) toast(`Imported ${res.added} moves · ${res.errors.length} problem${res.errors.length > 1 ? 's' : ''}: ${res.errors[0]}`, { kind: 'error' });
      else toast(`Imported ${res.added} move${res.added === 1 ? '' : 's'}`, { kind: 'success' });
      onClose();
      nav(`/rep/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Import PGN"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={!text.trim()} loading={busy}>
            Import
          </Button>
        </>
      }
    >
      <Field label="PGN" hint="All games and variations are merged. Comments become move notes.">
        <textarea className={`${inputCls} h-40 py-2.5 font-mono text-sm`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1. e4 e5 2. Nf3 Nc6 (2... d6) 3. Bb5 *'} spellCheck={false} />
      </Field>
      <Button
        size="sm"
        icon={FileUp}
        className="mt-2"
        onClick={async () => {
          const f = await platform().openFile(['.pgn', 'application/x-chess-pgn', 'text/plain']);
          if (f) {
            setText(f.content);
            if (!name) setName(f.name.replace(/\.pgn$/i, ''));
          }
        }}
      >
        Open a .pgn file
      </Button>
      <Field label="Into">
        <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="new">A new repertoire</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.color})
            </option>
          ))}
        </select>
      </Field>
      {target === 'new' && (
        <>
          <Field label="I play">
            <Segmented<Color> label="Colour" value={color} onChange={setColor} options={[{ value: 'white', label: 'White' }, { value: 'black', label: 'Black' }]} />
          </Field>
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Imported repertoire" />
          </Field>
        </>
      )}
    </Sheet>
  );
}
