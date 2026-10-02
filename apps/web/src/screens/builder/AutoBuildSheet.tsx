import { useEffect, useRef, useState } from 'react';
import type { Color } from '@mainline/shared';
import { addPopularReplies, type AutoBuildProgress } from '../../lib/autobuild';
import { ApiError } from '../../lib/api';
import { usePrefs } from '../../lib/prefs';
import { Sheet, Field } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { toast } from '../../ui/toast';
import { fmtPercent, t, tn } from '../../lib/i18n';

export function AutoBuildSheet({ open, onClose, repId, color, startFen }: { open: boolean; onClose: () => void; repId: string; color: Color; startFen: string }) {
  const rating = usePrefs((s) => s.rating);
  const [share, setShare] = useState('0.1');
  const [depth, setDepth] = useState('8');
  const [progress, setProgress] = useState<AutoBuildProgress | null>(null);
  const [running, setRunning] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) {
      ctrl.current?.abort();
      setProgress(null);
      setRunning(false);
    }
  }, [open]);

  const run = async () => {
    ctrl.current = new AbortController();
    setRunning(true);
    try {
      const res = await addPopularReplies({ repId, color, startFen, maxPlies: Number(depth), minShare: Number(share), signal: ctrl.current.signal, onProgress: setProgress });
      toast(tn(res.added, 'Added {n} reply', 'Added {n} replies') + (res.needsYourMove ? ` · ${tn(res.needsYourMove, '{n} position needs your move', '{n} positions need your move')}` : ''), { kind: 'success' });
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('Auto-build stopped'), { kind: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add popular replies')}
      footer={
        running ? (
          <Button onClick={() => ctrl.current?.abort()}>{t('Stop')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void run()}>
              {t('Add replies')}
            </Button>
          </>
        )
      }
    >
      <p className="text-sm text-ink-2">
        From this position, add every opponent reply played in at least the chosen share of games by players around <b className="tnum">{rating}</b>. Where it's your turn, your main move is followed; positions without one are left for you to decide.
      </p>
      <Field label={t('Include replies played in at least')}>
        <Segmented label={t('Minimum share')} value={share} onChange={setShare} options={[0.05, 0.1, 0.15, 0.25].map((v) => ({ value: String(v) as typeof share, label: fmtPercent(v) }))} />
      </Field>
      <Field label={t('How deep (moves from here)')}>
        <Segmented label={t('Depth')} value={depth} onChange={setDepth} options={[{ value: '4', label: '2' }, { value: '8', label: '4' }, { value: '12', label: '6' }, { value: '16', label: '8' }]} />
      </Field>
      {progress && (
        <div className="mt-4 rounded-[12px] bg-surface-2 p-3 text-sm" role="status">
          <div className="tnum flex justify-between">
            <span>{t('Positions checked')}</span>
            <b>{progress.visited}</b>
          </div>
          <div className="tnum flex justify-between">
            <span>{t('Replies added')}</span>
            <b>{progress.added}</b>
          </div>
          <div className="tnum flex justify-between">
            <span>{t('Need your move')}</span>
            <b>{progress.needsYourMove}</b>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-brand" />
          </div>
        </div>
      )}
    </Sheet>
  );
}
