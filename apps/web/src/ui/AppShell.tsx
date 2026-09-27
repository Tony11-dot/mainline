import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { platform } from '../platform';
import { usePrefs } from '../lib/prefs';
import { NAV } from './nav';
import { Wordmark } from './Logo';
import { Toaster } from './toast';
import { useT } from '../lib/i18n';

export function AppShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <Sidebar />
      <main
        className="min-w-0 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] md:pb-0"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <Outlet />
      </main>
      <TabBar />
      <Toaster />
    </div>
  );
}

function Sidebar() {
  const t = useT();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-e border-line bg-surface-2/60 px-3 py-5 md:flex">
      <div className="mb-6 flex items-center px-2 pt-1">
        <Wordmark height={30} />
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-[10px] px-3 text-base font-medium transition-colors duration-150 ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
              }`
            }
          >
            <Icon size={19} strokeWidth={2} aria-hidden />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function TabBar() {
  const t = useT();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  // The tab under the finger while it slides along the bar; lifting the finger opens it.
  const [hover, setHover] = useState<number | null>(null);
  const slid = useRef(false);
  // Training is immersive on phones: no tab bar competing with the board.
  if (path.startsWith('/train')) return null;

  const indexAt = (el: HTMLElement, x: number) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(NAV.length - 1, Math.floor(((x - r.left) / r.width) * NAV.length)));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return; // mice click; fingers and pens slide
    e.currentTarget.setPointerCapture(e.pointerId);
    slid.current = true;
    setHover(indexAt(e.currentTarget, e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (hover === null) return;
    const i = indexAt(e.currentTarget, e.clientX);
    if (i !== hover) {
      setHover(i);
      if (usePrefs.getState().haptics) platform().haptic('selection');
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (hover === null) return;
    const i = indexAt(e.currentTarget, e.clientX);
    setHover(null);
    void navigate(NAV[i]!.to);
  };

  return (
    <nav
      aria-label="Main"
      data-web-tabbar
      className="glass fixed inset-x-3 z-[var(--z-chrome)] flex h-[var(--tabbar-h)] touch-none items-stretch justify-around rounded-[26px] px-1 select-none md:hidden"
      style={{ bottom: 'calc(var(--safe-bottom) + 10px)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setHover(null)}
      // The finger already navigated on pointerup; swallow the follow-up click. Keyboard clicks pass.
      onClickCapture={(e) => {
        if (slid.current) {
          e.preventDefault();
          slid.current = false;
        }
      }}
    >
      {NAV.map(({ to, key, icon: Icon }, i) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          draggable={false}
          className={({ isActive }) => {
            const lit = hover === null ? isActive : hover === i;
            return `relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-[20px] text-[10.5px] font-semibold transition-[color,background-color,transform] duration-150 ${
              lit ? 'text-brand' : 'text-ink-3'
            } ${hover === i ? 'scale-[1.06] bg-brand-soft' : ''}`;
          }}
        >
          <Icon size={22} strokeWidth={2} aria-hidden />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}
