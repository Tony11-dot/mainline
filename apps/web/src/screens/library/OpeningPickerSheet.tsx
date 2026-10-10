import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { Color } from '@mainline/shared';
import { useGames } from '../../lib/games';
import { FIRST_MOVES, PACKS, REPLY_NAMES, ensureOpeningFolders, firstFolderName, openingFolderName, openingRecords, type FirstMove } from '../../lib/packs';
import { Sheet } from '../../ui/Sheet';
import { RecordBadge } from './practiceUi';
import { t, tn } from '../../lib/i18n';

/**
 * Adds a level to the library: a first move under White/Black, or an opening under a first move.
 * Each choice shows how you score there and whether ready-made lines exist, so the next step is obvious.
 */
export function OpeningPickerSheet({ open, color, first, onClose }: { open: boolean; color: Color; first?: FirstMove; onClose: () => void }) {
  const nav = useNavigate();
  const games = useGames((g) => g.games);
  const records = useMemo(() => openingRecords(games), [games]);

  const go = async (reply?: string) => {
    const f = await ensureOpeningFolders(color, first ?? (reply as FirstMove), first ? reply : undefined);
    onClose();
    nav(`/library?f=${f.id}`);
  };

  const rows = first
    ? Object.keys(REPLY_NAMES[first]).map((reply) => {
        const recs = records.filter((r) => r.color === color && r.first === first && r.reply === reply);
        return { key: reply, label: openingFolderName(color, first, reply), rec: recs[0], packs: PACKS.filter((p) => p.color === color && p.first === first && p.reply === reply).length };
      })
    : FIRST_MOVES.map((f) => {
        const recs = records.filter((r) => r.color === color && r.first === f);
        const games = recs.reduce((n, r) => n + r.games, 0);
        const points = recs.reduce((n, r) => n + r.score * r.games, 0);
        return { key: f, label: firstFolderName(color, f), rec: games ? { color, first: f, reply: '', games, score: points / games, win: 0, draw: 0, loss: 0 } : undefined, packs: PACKS.filter((p) => p.color === color && p.first === f).length };
      });

  const title = first
    ? color === 'white'
      ? t('Which reply to 1.{move}?', { move: first })
      : t('Your answer to 1.{move}', { move: first })
    : color === 'white'
      ? t('Your first move')
      : t('Which first move to answer?');

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="-mt-1 text-base text-ink-2">{first ? t('Each opening gets its own folder of lines.') : t('Each first move gets its own folder of openings.')}</p>
      <ul className="-mx-3 mt-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={() => void go(r.key)} className="pressable flex min-h-[60px] w-full items-center gap-3 rounded-[var(--radius-m)] px-3 py-2.5 text-start hover:bg-surface-2 active:bg-surface-3">
              <span className="min-w-0 flex-1">
                <span className="block text-md font-semibold">{r.label}</span>
                {r.packs > 0 && (
                  <span className="flex items-center gap-1 text-sm text-ink-2">
                    <Sparkles size={13} aria-hidden /> {tn(r.packs, '{n} ready-made set', '{n} ready-made sets')}
                  </span>
                )}
              </span>
              <RecordBadge rec={r.rec} />
              <ChevronRight size={20} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
