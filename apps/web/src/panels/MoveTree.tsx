import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { ChevronRight } from 'lucide-react';
import { childPath, type TreeNode } from '@mainline/shared';
import type { AnalysisStore } from '../board/analysis';
import { t, tn } from '../lib/i18n';

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

  // Keep the current move visible inside the panel's own scroller only: never scroll the page, or the board
  // would slide away under the player's finger on phones.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    const box = el && scrollParent(el);
    if (!el || !box) return;
    const e = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const delta = e.top < b.top ? e.top - b.top - 8 : e.bottom > b.bottom ? e.bottom - b.bottom + 8 : 0;
    if (delta) box.scrollBy({ top: delta, behavior: 'smooth' });
  }, [path]);

  if (!root.children.length)
    return <p className="px-5 py-8 text-center text-base text-ink-2">{emptyHint ?? t('Make a move on the board to start.')}</p>;

  const ctx: Ctx = { current: path, goto: (p) => store.getState().goto(p), collapsed, toggle: (p) => store.getState().toggleCollapsed(p) };
  return (
    <div ref={ref} dir="ltr" className="px-4 py-3 text-start text-md leading-[2]" role="tree" aria-label={t('Moves')}>
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
    <div className="relative my-0.5 ms-2 border-s border-line-strong ps-3" role="group">
      <button
        type="button"
        onClick={() => ctx.toggle(key)}
        // Sits on the variation rail beside the first line, so it never takes a row of its own.
        className="absolute -start-[9px] top-[0.475em] inline-flex size-[17px] items-center justify-center rounded-full bg-surface text-ink-3 ring-1 ring-line-strong before:absolute before:-inset-3 before:content-[''] hover:text-ink"
        aria-expanded={!closed}
        aria-label={closed ? tn(vars.length, 'Show {n} variation', 'Show {n} variations') : t('Hide variations')}
      >
        <ChevronRight size={11} strokeWidth={2.6} className={`transition-transform duration-150 ${closed ? 'rtl:rotate-180' : 'rotate-90'}`} />
      </button>
      {closed ? (
        <span className="text-sm text-ink-3">{tn(vars.length, '{n} variation', '{n} variations')}</span>
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
      {showNumber && <span className="tnum me-0.5 text-ink-3">{white ? `${n}.` : `${n}…`}</span>}
      <button
        type="button"
        role="treeitem"
        aria-selected={active}
        data-active={active}
        onClick={() => ctx.goto(path)}
        title={node.tags?.includes('alt') ? t('Alternate move (not trained)') : node.tags?.includes('tr') ? t('Transposition: this position is reached by another move order too') : undefined}
        className={`me-1 rounded-[var(--radius-xs)] px-1 font-semibold transition-colors duration-100 ${
          active ? 'bg-brand text-on-brand' : node.tags?.includes('alt') ? 'italic text-ink-3 hover:bg-brand-soft' : 'text-ink hover:bg-brand-soft'
        }`}
      >
        {node.san}
        {node.tags?.includes('tr') && <span className={`ms-0.5 text-[0.7em] ${active ? 'text-on-brand/80' : 'text-brand'}`} aria-label={t('transposition')}>⇄</span>}
        {node.tags?.includes('note') && <span className={`ms-0.5 inline-block size-1.5 rounded-full align-super ${active ? 'bg-on-brand' : 'bg-warn'}`} aria-label={t('has a note')} />}
      </button>
    </>
  );
}

/** Nearest ancestor that scrolls vertically on its own (not the page itself). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}
