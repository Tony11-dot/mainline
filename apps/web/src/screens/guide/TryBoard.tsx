import { useEffect, useRef, useState } from 'react';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { RotateCcw } from 'lucide-react';
import { legalDests, positionFromFen } from '@mainline/shared';
import { Board } from '../../board/Board';
import { Button } from '../../ui/primitives';
import { t } from '../../lib/i18n';

// The Italian Game after 1.e4 e5 2.Nf3 Nc6: White's repertoire move is 3.Bc4.
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const MOVE = 'f1c4';
const SAN = 'Bc4';
const AFTER = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

type Phase = 'learn' | 'again' | 'await' | 'wrong' | 'done';

/** One learn-then-recall cycle on a real board: the move with an arrow first, then the same position from memory. */
export function TryBoard() {
  const [phase, setPhase] = useState<Phase>('learn');
  const [fen, setFen] = useState(FEN);
  const [flash, setFlash] = useState<{ kind: 'wrong' | 'right'; key: number }>();
  const [syncKey, setSyncKey] = useState(0);
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pos = positionFromFen(fen);
  const yourTurn = phase === 'learn' || phase === 'await' || phase === 'wrong';

  const onMove = (uci: string) => {
    if (uci !== MOVE) {
      // Like a session: the board snaps back, the right move is shown and must be played.
      setFlash({ kind: 'wrong', key: Date.now() });
      setSyncKey((k) => k + 1);
      if (phase === 'await') setPhase('wrong');
      return;
    }
    setFlash({ kind: 'right', key: Date.now() });
    setFen(AFTER);
    if (phase === 'learn') {
      setPhase('again');
      timer.current = window.setTimeout(() => {
        setFen(FEN);
        setSyncKey((k) => k + 1);
        setPhase('await');
      }, 1600);
    } else setPhase('done');
  };

  const restart = () => {
    clearTimeout(timer.current);
    setFen(FEN);
    setSyncKey((k) => k + 1);
    setPhase('learn');
  };

  const arrow: DrawShape[] = phase === 'learn' || phase === 'wrong' ? [{ orig: 'f1', dest: 'c4', brush: phase === 'wrong' ? 'green' : 'blue' }] : [];
  const prompt =
    phase === 'learn'
      ? { title: t('New move: {move}', { move: SAN }), sub: t('Play it on the board to learn it.'), tone: 'text-brand-ink' }
      : phase === 'again'
        ? { title: t('Learned'), sub: t('Now from memory: the same position comes back later, without the arrow.'), tone: 'text-good-ink' }
        : phase === 'await'
          ? { title: t('Your move'), sub: t('Find your repertoire move for White.'), tone: 'text-ink' }
          : phase === 'wrong'
            ? { title: t('Not quite — it’s {move}', { move: SAN }), sub: t('Play the move shown to continue.'), tone: 'text-bad-ink' }
            : { title: t('Line complete'), sub: t('That’s the whole routine: see a move once, then recall it until it sticks.'), tone: 'text-good-ink' };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full max-w-[min(340px,100%)]">
        <Board
          fen={fen}
          orientation="white"
          turnColor={pos.turn}
          movable={yourTurn ? 'white' : undefined}
          dests={yourTurn ? (legalDests(pos) as Map<Key, Key[]>) : new Map()}
          autoShapes={arrow}
          onMove={onMove}
          flash={flash}
          syncKey={syncKey}
          ariaLabel={`${t('Training board.')} ${t('White to move.')}`}
        />
      </div>
      <div className="flex w-full max-w-[340px] flex-col gap-1 text-center" aria-live="polite" data-phase={phase}>
        <p className={`text-xl font-bold tracking-tight ${prompt.tone}`}>{prompt.title}</p>
        <p className="text-base text-ink-2">{prompt.sub}</p>
        {phase === 'done' && (
          <div className="mt-2">
            <Button size="sm" icon={RotateCcw} onClick={restart}>
              {t('Again')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
