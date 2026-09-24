import { NavLink, Outlet, useLocation } from 'react-router';
import { NAV } from './nav';
import { Wordmark } from './Logo';
import { Toaster } from './toast';

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
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface-2/60 px-3 py-5 md:flex">
      <div className="mb-6 flex items-center px-2 pt-1">
        <Wordmark height={30} />
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function TabBar() {
  // Training is immersive on phones: no tab bar competing with the board.
  if (useLocation().pathname.startsWith('/train')) return null;
  return (
    <nav
      aria-label="Main"
      data-web-tabbar
      className="glass fixed inset-x-3 z-[var(--z-chrome)] flex h-[var(--tabbar-h)] items-stretch justify-around rounded-[26px] px-1 md:hidden"
      style={{ bottom: 'calc(var(--safe-bottom) + 10px)' }}
    >
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-[20px] text-[10.5px] font-semibold transition-colors duration-150 ${
              isActive ? 'text-brand' : 'text-ink-3'
            }`
          }
        >
          <Icon size={22} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
