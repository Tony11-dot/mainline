import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { ChevronRight } from 'lucide-react';
import { childPath, type TreeNode } from '@mainline/shared';
import type { AnalysisStore } from '../board/analysis';

/**
 * Lichess-style inline move list: the mainline flows as text, variations are indented blocks that can
 * be collapsed. The current move is highlighted and kept in view.
 */
export function MoveTree({ store, emptyHint }: { store: AnalysisStore; emptyHint?: string }) {
  const root = useStore(store, (s) => s.root);
  const path = useStore(store, (s) => s.path);
  useStore(store, (s) => s.version);
  const collapsed = useStore(store, (s) => s.collapsed);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [path]);

  if (!root.children.length)
    return <p className="px-4 py-6 text-center text-sm text-ink-3">{emptyHint ?? 'Make a move on the board to start.'}</p>;

  const ctx: Ctx = { current: path, goto: (p) => store.getState().goto(p), collapsed, toggle: (p) => store.getState().toggleCollapsed(p) };
  return (
    <div ref={ref} className="px-3 py-2 text-[0.9375rem] leading-[1.9]" role="tree" aria-label="Moves">
      <Line parent={root} parentPath="" ctx={ctx} forceNumber />
    </div>
  );
}

interface Ctx {
  current: string;
  goto: (p: string) => void;
  collapsed: Set<string>;
  toggle: (p: string) => void;
}

/** Renders the continuation of `parent`: its main child, then side variations, then the rest of the mainline. */
function Line({ parent, parentPath, ctx, forceNumber }: { parent: TreeNode; parentPath: string; ctx: Ctx; forceNumber?: boolean }) {
  const out: React.ReactNode[] = [];
  let node = parent;
  let p = parentPath;
  let needNumber = !!forceNumber;
  while (node.children.length) {
    const [main, ...vars] = node.children;
    const mp = childPath(p, main!.uci);
    out.push(<Move key={mp} node={main!} path={mp} ctx={ctx} showNumber={needNumber || main!.ply % 2 === 1} />);
    needNumber = false;
    if (vars.length) {
      out.push(
        <Variations key={`${mp}-vars`} parentPath={p} vars={vars} ctx={ctx} />,
      );
      needNumber = true;
    }
    node = main!;
    p = mp;
  }
  return <>{out}</>;
}

function Variations({ parentPath, vars, ctx }: { parentPath: string; vars: TreeNode[]; ctx: Ctx }) {
  const key = `${parentPath}|vars`;
  const closed = ctx.collapsed.has(key);
  return (
    <div className="my-0.5 ml-1 border-l border-line-strong pl-2.5" role="group">
      <button
        type="button"
        onClick={() => ctx.toggle(key)}
        className="-ml-[17px] mr-0.5 inline-flex size-4 items-center justify-center rounded-full bg-surface text-ink-3 ring-1 ring-line hover:text-ink align-middle"
        aria-expanded={!closed}
        aria-label={closed ? `Show ${vars.length} variation${vars.length > 1 ? 's' : ''}` : 'Hide variations'}
      >
        <ChevronRight size={11} strokeWidth={2.6} className={`transition-transform duration-150 ${closed ? '' : 'rotate-90'}`} />
      </button>
      {closed ? (
        <span className="text-sm text-ink-3">
          {vars.length} variation{vars.length > 1 ? 's' : ''}
        </span>
      ) : (
        vars.map((v) => {
          const vp = childPath(parentPath, v.uci);
          return (
            <div key={vp} className="text-ink-2">
              <Move node={v} path={vp} ctx={ctx} showNumber />
              <Line parent={v} parentPath={vp} ctx={ctx} />
            </div>
          );
        })
      )}
    </div>
  );
}

function Move({ node, path, ctx, showNumber }: { node: TreeNode; path: string; ctx: Ctx; showNumber: boolean }) {
  const active = ctx.current === path;
  const n = Math.floor((node.ply - 1) / 2) + 1;
  const white = node.ply % 2 === 1;
  return (
    <>
      {showNumber && <span className="tnum mr-0.5 text-ink-3">{white ? `${n}.` : `${n}…`}</span>}
      <button
        type="button"
        role="treeitem"
        aria-selected={active}
        data-active={active}
        onClick={() => ctx.goto(path)}
        className={`mr-1 rounded-[6px] px-1 font-semibold transition-colors duration-100 ${
          active ? 'bg-brand text-white' : 'text-ink hover:bg-brand-soft'
        }`}
      >
        {node.san}
      </button>
    </>
  );
}
