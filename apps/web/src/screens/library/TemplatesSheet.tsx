import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Color } from '@mainline/shared';
import { useLibrary } from '../../lib/library';
import { TEMPLATES, TEMPLATE_GROUPS, addTemplate, templateMainLine, type Template } from '../../lib/templates';
import { Sheet } from '../../ui/Sheet';
import { Button, Segmented } from '../../ui/primitives';
import { MiniBoard } from '../../ui/MiniBoard';
import { toast } from '../../ui/toast';
import { parseSanLine } from './sanLine';
import { t } from '../../lib/i18n';

/** Complete, ready-to-learn repertoires: pick one and it lands in your library, every main reply covered. */
export function TemplatesSheet({ open, color: initialColor = 'white', onClose }: { open: boolean; color?: Color; onClose: () => void }) {
  const [color, setColor] = useState<Color>(initialColor);
  useEffect(() => {
    if (open) setColor(initialColor);
  }, [open, initialColor]);

  return (
    <Sheet open={open} onClose={onClose} title={t('Ready-made repertoires')} wide>
      <p className="-mt-1 text-sm text-ink-2">{t('Complete repertoires that answer every main reply. Add one, then learn it as is or make it your own.')}</p>
      <Segmented<Color> label={t('Colour')} value={color} onChange={setColor} options={[{ value: 'white', label: t('White') }, { value: 'black', label: t('Black') }]} />
      {TEMPLATE_GROUPS.filter((g) => g.color === color).map((g) => (
        <section key={g.vs} aria-label={g.color === 'white' ? t('With {move}', { move: g.vs }) : t('vs {move}', { move: g.vs })}>
          <h3 className="mb-2 text-sm font-bold text-ink-2">{g.color === 'white' ? t('With {move}', { move: g.vs }) : t('vs {move}', { move: g.vs })}</h3>
          <ul className="flex flex-col gap-2">
            {TEMPLATES.filter((x) => x.color === g.color && x.vs === g.vs).map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} onDone={onClose} />
            ))}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}

function TemplateCard({ tpl, onDone }: { tpl: Template; onDone: () => void }) {
  const nav = useNavigate();
  const existing = useLibrary((s) => s.reps.find((r) => !r.deleted && r.color === tpl.color && r.name === t(tpl.name)));
  const [busy, setBusy] = useState(false);
  const fen = parseSanLine(templateMainLine(tpl)).fen;

  const add = async () => {
    setBusy(true);
    try {
      const rep = await addTemplate(tpl);
      onDone();
      nav(`/rep/${rep.id}`);
      toast(t('Added {name}', { name: t(tpl.name) }), { kind: 'success', action: { label: t('Learn'), run: () => nav('/train?mode=learn') } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-[16px] border border-line bg-surface p-3">
      <div className="flex gap-3">
        <MiniBoard fen={fen} size={64} orientation={tpl.color} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold leading-snug">{t(tpl.name)}</h4>
            {existing ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onDone();
                  nav(`/rep/${existing.id}`);
                }}
              >
                {t('Open')}
              </Button>
            ) : (
              <Button size="sm" variant="primary" loading={busy} onClick={() => void add()}>
                {t('Add')}
              </Button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{t(tpl.blurb)}</p>
        </div>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1" aria-label={t('Covers')}>
        {tpl.covers.map(([moves, name]) => (
          <li key={moves + name} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-3 px-2 text-xs text-ink-2">
            <bdi className="font-semibold text-ink" dir="ltr">
              {moves}
            </bdi>
            <bdi>{name}</bdi>
          </li>
        ))}
      </ul>
    </li>
  );
}
