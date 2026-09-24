import { useEffect, useState } from 'react';
import { Sheet, Field, inputCls } from '../../ui/Sheet';
import { Button } from '../../ui/primitives';

export function PromptSheet({ open, title, label, placeholder, initial = '', confirm, onClose, onSubmit }: { open: boolean; title: string; label: string; placeholder?: string; initial?: string; confirm: string; onClose: () => void; onSubmit: (v: string) => Promise<void> | void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const submit = async () => {
    if (!value.trim()) return;
    await onSubmit(value.trim());
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!value.trim()}>
            {confirm}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={label}>
          <input autoFocus className={inputCls} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} maxLength={80} />
        </Field>
      </form>
    </Sheet>
  );
}
