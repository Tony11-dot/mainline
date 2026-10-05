import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingDown } from 'lucide-react';
import { useLibrary } from '../../lib/library';
import { addPack, openingFolderName, packFolderName, packLinesIn, type OpeningRecord, type Pack } from '../../lib/packs';
import { practiceHref } from '../../lib/practice';
import { Button } from '../../ui/primitives';
import { toast } from '../../ui/toast';
import { fmtPercent, t, tn } from '../../lib/i18n';

/**
 * The opening your games say you lose most, and the fix: ready-made lines for it (or, once you have them,
 * a test). One clear next step instead of a table to interpret.
 */
export function WeakSpotCard({ spot }: { spot: OpeningRecord & { packs: Pack[] } }) {
  const nav = useNavigate();
  const reps = useLibrary((s) => s.reps);
  const folders = useLibrary((s) => s.folders);
  const [busy, setBusy] = useState(false);
  const owned = spot.packs.find((p) => packLinesIn(reps, p).length === p.lines.length);
  const ownedFolder = owned && folders.find((f) => !f.deleted && f.name === packFolderName(owned));
  const single = spot.packs.length === 1 ? spot.packs[0] : undefined;
  const name = openingFolderName(spot.color, spot.first, spot.reply);

  const add = async (p: Pack) => {
    setBusy(true);
    try {
      const f = await addPack(p);
      toast(t('Added {n} lines to {name}', { n: p.lines.length, name: t(f.name) }), { kind: 'success' });
      nav(`/library?f=${f.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-l)] border border-bad/30 bg-bad-soft/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-bad uppercase">
        <TrendingDown size={14} aria-hidden /> {t('Your weakest opening')}
      </p>
      <h2 className="mt-1 text-lg font-bold">
        {spot.color === 'white' ? t('As White, 1.{first} {reply}', { first: spot.first, reply: name }) : t('As Black, {opening} vs 1.{first}', { opening: name, first: spot.first })}
      </h2>
      <p className="tnum text-sm text-ink-2">{tn(spot.games, 'You score {score} in {n} game: {w} won, {d} drawn, {l} lost.', 'You score {score} in {n} games: {w} won, {d} drawn, {l} lost.', { score: fmtPercent(spot.score), w: spot.win, d: spot.draw, l: spot.loss })}</p>
      {owned ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm">{t('You have ready-made lines for it. Test yourself until they stick.')}</p>
          {ownedFolder && (
            <Link to={practiceHref({ kind: 'folder', id: ownedFolder.id }, 'test')} className="inline-flex h-10 items-center rounded-[12px] bg-brand px-4 font-semibold text-on-brand">
              {t('Test me')}
            </Link>
          )}
        </div>
      ) : single ? (
        <div className="mt-3">
          <p className="text-sm">
            {t('Ready-made lines for it:')} <span className="text-ink-2">{single.lines.map((l) => l.name).join(' · ')}</span>
          </p>
          <Button variant="primary" className="mt-3" loading={busy} onClick={() => void add(single)}>
            {tn(single.lines.length, 'Add {n} line', 'Add {n} lines')}
          </Button>
        </div>
      ) : spot.packs.length ? (
        <Link to={`/library/ready?color=${spot.color}&first=${spot.first}&reply=${encodeURIComponent(spot.reply)}`} className="mt-3 inline-flex h-10 items-center rounded-[12px] bg-brand px-4 font-semibold text-on-brand">
          {tn(spot.packs.length, 'See {n} ready-made set', 'See {n} ready-made sets')}
        </Link>
      ) : null}
    </div>
  );
}
