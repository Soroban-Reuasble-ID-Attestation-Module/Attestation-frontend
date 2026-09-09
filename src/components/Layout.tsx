import { NavLink, Outlet, Link } from 'react-router-dom';
import { WalletConnect } from '@/components/WalletConnect';
import { deployment } from '@/config';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/issue', label: 'Issue' },
  { to: '/verify', label: 'Verify' },
  { to: '/revoke', label: 'Revoke' },
  { to: '/disclose', label: 'Selective Disclosure' },
  { to: '/registry', label: 'Registry' },
  { to: '/escrow', label: 'USDC Escrow' },
];

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              A
            </span>
            <span className="text-sm font-semibold text-slate-100">
              Attestation Protocol
              <span className="ml-2 hidden text-xs font-normal text-slate-500 sm:inline">
                {deployment.network}
              </span>
            </span>
          </Link>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto pb-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto sm:ml-0">
            <WalletConnect />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-600">
        Attestation Protocol · testnet deployment · no secret keys are ever
        stored by this application.
      </footer>
    </div>
  );
}