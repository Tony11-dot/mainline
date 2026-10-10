import { useMemo } from 'react';
import { GitBranch, Replace, Scissors, Trash2 } from 'lucide-react';
import { INITIAL_FEN, childPath, playLine, type TreeNode } from '@mainline/shared';
import { Button } from '../../ui/primitives';
import { t, tn } from '../../lib/i18n';

interface Step {
  node: TreeNode;
  path: string;
}

/**
 * The line as a row of moves you can tap: where it starts (greyed, the position its folder stands for), the moves
 * up to where you are, and where the line carries on from there. Under it, what you can do at the selected move:
 * end the line there, change the move, delete it, or branch a new line off it.
 */
export function LinePanel({
  root,
  path,
  rootUcis,
  ready,
  onGoto,
  onCut,
  onChange,
  onDelete,
  onBranch,
}: {
  root: TreeNode;
  path: string;
  rootUcis: string[];
  ready: boolean;
  onGoto: (path: string) => void;
  onCut: () => void;
  onChange: () => void;
  onDelete: () => void;
  onBranch: () => void;
}) {
  const steps = useMemo(() => lineThrough(root, path), [root, path]);
  const start = useMemo(() => {
    try {
      return playLine(INITIAL_FEN, rootUcis).moves.map((m) => m.san);
    } catch {
      return [];
    }
  }, [rootUcis]);
  const here = steps.find((s) => s.path === path)?.node ?? root;
  const atRoot = path === '';
  const forks = steps.filter((s) => s.node.children.length > 1).length + (root.children.length > 1 ? 1 : 0);

  return (
    <section aria-label={t('The line')} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('The line')}</h2>
        <span className="tnum text-sm text-ink-2">
          {tn(steps.length, '{n} move', '{n} moves')}
          {forks > 0 && ` · ${tn(forks, '{n} branch point', '{n} branch points')}`}
        </span>
      </div>
      <ol dir="ltr" className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-base" aria-label={t('Moves in this line')}>
        {start.length > 0 && (
          <li className="me-1 text-ink-3">
            <button type="button" onClick={() => onGoto('')} aria-current={atRoot ? 'step' : undefined} className={`min-h-[36px] rounded-[var(--radius-xs)] px-2 py-1 ${atRoot ? 'bg-brand text-on-brand' : 'hover:bg-surface-3'}`}>
              {start.map((san, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${san}`).join(' ')}
            </button>
          </li>
        )}
        {steps.map(({ node, path: p }, i) => {
          const white = node.ply % 2 === 1;
          const num = Math.ceil(node.ply / 2);
          const label = white ? `${num}.${node.san}` : i === 0 ? `${num}…${node.san}` : node.san;
          const on = p === path;
          return (
            <li key={p} className="flex items-center">
              <button
                type="button"
                onClick={() => onGoto(p)}
                aria-current={on ? 'step' : undefined}
                className={`tnum min-h-[36px] rounded-[var(--radius-xs)] px-2 py-1 font-semibold ${on ? 'bg-brand text-on-brand' : p.length < path.length || !path ? 'text-ink hover:bg-surface-3' : 'text-ink-2 hover:bg-surface-3'}`}
              >
                {label}
              </button>
              {node.children.length > 1 && (
                <span className="ms-0.5 inline-flex items-center text-xs text-ink-3" title={tn(node.children.length - 1, '{n} other move here', '{n} other moves here')}>
                  <GitBranch size={12} aria-hidden />
                  {node.children.length - 1}
                </span>
              )}
            </li>
          );
        })}
        <li className="ms-1.5 text-sm font-semibold text-ink-3">{steps.length ? t('end') : t('Play the first move on the board')}</li>
      </ol>
      {!ready ? (
        <div className="flex flex-wrap gap-2">
          {here.children.length > 0 && (
            <Button size="sm" variant="ghost" icon={Scissors} onClick={onCut}>
              {atRoot ? t('Clear the line') : t('End the line here')}
            </Button>
          )}
          {!atRoot && (
            <>
              <Button size="sm" variant="ghost" icon={Replace} onClick={onChange}>
                {t('Change {move}', { move: here.san })}
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete} className="text-bad-ink hover:text-bad-ink">
                {t('Delete {move}', { move: here.san })}
              </Button>
            </>
          )}
          {here.children.length > 0 && (
            <Button size="sm" variant="ghost" icon={GitBranch} onClick={onBranch}>
              {t('New line from here')}
            </Button>
          )}
        </div>
      ) : (
        here.children.length > 0 && (
          <div>
            <Button size="sm" variant="ghost" icon={GitBranch} onClick={onBranch}>
              {t('New line of my own from here')}
            </Button>
          </div>
        )
      )}
    </section>
  );
}

/** The moves of the line through `path`: the way there, then on along each first continuation to the end. */
export function lineThrough(root: TreeNode, path: string): Step[] {
  const out: Step[] = [];
  let node = root;
  let p = '';
  const want = path ? path.split(' ') : [];
  for (const u of want) {
    const next = node.children.find((c) => c.uci === u);
    if (!next) break;
    p = childPath(p, u);
    out.push({ node: next, path: p });
    node = next;
  }
  const seen = new Set(out.map((s) => s.node.epd));
  for (let next = node.children[0]; next && !seen.has(next.epd) && out.length < 200; next = next.children[0]) {
    p = childPath(p, next.uci);
    out.push({ node: next, path: p });
    seen.add(next.epd);
  }
  return out;
}
