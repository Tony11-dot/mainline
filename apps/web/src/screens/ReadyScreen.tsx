import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check } from 'lucide-react';
import type { Color } from '@mainline/shared';
import { useLibrary } from '../lib/library';
import { useGames } from '../lib/games';
import { FIRST_MOVES, PACKS, addPack, mainLineText, openingFolderName, openingRecords, packFolderName, packLinesIn, recordFor, weakSpots, type FirstMove, type Pack } from '../lib/packs';
import { practiceHref } from '../lib/practice';
import { Button, Segmented } from '../ui/primitives';
import { MiniBoard } from '../ui/MiniBoard';
import { toast } from '../ui/toast';
import { parseSanLine } from './library/sanLine';
import { RecordBadge } from './library/practiceUi';
import { WeakSpotCard } from './library/WeakSpotCard';
import { t, tn } from '../lib/i18n';

/**
 * Every ready-made opening, by colour → first move → reply. A set drops its lines into the right
 * folder (White › 1.e4 › vs Caro-Kann), ready to practise — nothing to build.
 */
export function ReadyScreen() {
  const [params, setParams] = useSearchParams();
  const color = (params.get('color') as Color) ?? 'white';
  const first = (params.get('first') as FirstMove) ?? 'e4';
  const only = params.get('reply');
  const games = useGames((g) => g.games);
  useEffect(() => {
    void useLibrary.getState().load();
    void useGames.getState().load();
  }, []);
  const records = useMemo(() => openingRecords(games), [games]);
  const spots = useMemo(() => weakSpots(games).slice(0, 2), [games]);
  const set = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) if (v === null) q.delete(k);
    else q.set(k, v);
    setParams(q, { replace: true });
  };

  const packs = PACKS.filter((p) => p.color === color && p.first === first && (!only || p.reply === only));
  const replies = [...new Set(packs.map((p) => p.reply))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-2">
        <Link to="/library" className="-ms-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back')}>
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">{t('Ready-made openings')}</h1>
      </div>
      <p className="mt-1 text-ink-2">{t('Each set is a few named lines for one opening. Add it and practise straight away — no building needed.')}</p>

      {!only && spots.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {spots.map((s) => (
            <WeakSpotCard key={`${s.color}${s.first}${s.reply}`} spot={s} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Segmented<Color> label={t('Colour')} value={color} onChange={(c) => set({ color: c, reply: null })} options={[{ value: 'white', label: <span className="whitespace-nowrap px-1">{t('As White')}</span> }, { value: 'black', label: <span className="whitespace-nowrap px-1">{t('As Black')}</span> }]} />
        <Segmented<FirstMove>
          label={t('First move')}
          value={first}
          onChange={(f) => set({ first: f, reply: null })}
          options={FIRST_MOVES.map((f) => ({ value: f, label: <span className="whitespace-nowrap px-1">{color === 'white' ? `1.${f}` : t('vs {move}', { move: `1.${f}` })}</span> }))}
        />
      </div>
      {only && (
        <button type="button" onClick={() => set({ reply: null })} className="mt-3 text-sm font-semibold text-brand hover:underline">
          {t('Show every opening')}
        </button>
      )}

      {replies.map((reply) => (
        <section key={reply} className="mt-7" aria-label={openingFolderName(color, first, reply)}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-md font-bold">{openingFolderName(color, first, reply)}</h2>
            <RecordBadge rec={recordFor(records, color, first, reply)} />
          </div>
          {color === 'white' && packs.filter((p) => p.reply === reply).length > 1 && <p className="mb-2 px-1 text-sm text-ink-3">{t('Pick one system — they answer the same reply in different ways.')}</p>}
          <ul className="flex flex-col gap-2">
            {packs
              .filter((p) => p.reply === reply)
              .map((p) => (
                <PackCard key={p.id} pack={p} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PackCard({ pack }: { pack: Pack }) {
  const nav = useNavigate();
  const reps = useLibrary((s) => s.reps);
  const folders = useLibrary((s) => s.folders);
  const have = packLinesIn(reps, pack).length;
  const complete = have === pack.lines.length;
  const folder = folders.find((f) => !f.deleted && f.name === packFolderName(pack));
  const [busy, setBusy] = useState(false);
  const fen = parseSanLine(mainLineText(pack.lines[0]!.pgn, 8)).fen;

  const add = async () => {
    setBusy(true);
    try {
      const f = await addPack(pack);
      toast(t('Added {n} lines to {name}', { n: pack.lines.length - have, name: t(f.name) }), { kind: 'success', action: { label: t('Show me'), run: () => nav(practiceHref({ kind: 'folder', id: f.id }, 'show')) } });
      nav(`/library?f=${f.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-[16px] border border-line bg-surface p-3 shadow-1">
      <div className="flex gap-3">
        <MiniBoard fen={fen} size={64} orientation={pack.color} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold leading-snug">{t(pack.name)}</h3>
              <p className="text-sm text-ink-2">{tn(pack.lines.length, '{n} line', '{n} lines')}</p>
            </div>
            {complete ? (
              <Button size="sm" icon={Check} onClick={() => folder && nav(`/library?f=${folder.id}`)}>
                {t('Added')}
              </Button>
            ) : (
              <Button size="sm" variant="primary" loading={busy} onClick={() => void add()}>
                {have ? t('Add the rest') : t('Add')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <ol className="mt-2.5 flex flex-col gap-1" aria-label={t('Lines')}>
        {pack.lines.map((l) => (
          <li key={l.id} className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-sm font-semibold">{l.name}</span>
            <bdi className="block truncate text-xs text-ink-3" dir="ltr">
              {mainLineText(l.pgn, 12)}
            </bdi>
          </li>
        ))}
      </ol>
    </li>
  );
}
