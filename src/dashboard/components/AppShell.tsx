/**
 * The dashboard frame: a fixed sidebar and a scrolling content column.
 *
 * Below 900px the sidebar collapses to a horizontal tab strip, which keeps the
 * product usable in a narrow window without a hamburger menu or a drawer.
 */
import type { ReactNode } from 'react';
import { BRANDING } from '../../shared/branding';
import { hrefFor, type Route } from '../router';

interface NavItem {
  label: string;
  route: Route;
  /** Route names that should also light this item up. */
  matches: Route['name'][];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', route: { name: 'overview' }, matches: ['overview'] },
  { label: 'Websites', route: { name: 'websites' }, matches: ['websites', 'website'] },
  { label: 'Sessions', route: { name: 'sessions' }, matches: ['sessions'] },
  { label: 'Settings', route: { name: 'settings' }, matches: ['settings'] },
];

interface AppShellProps {
  route: Route;
  children: ReactNode;
}

export function AppShell({ route, children }: AppShellProps) {
  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
          focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header
        className="border-b border-line bg-canvas lg:sticky lg:top-0 lg:h-screen lg:w-56
          lg:shrink-0 lg:border-b-0 lg:border-r"
      >
        <div className="flex items-center gap-2.5 px-5 py-4 lg:py-5">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-ink">{BRANDING.name}</span>
        </div>

        <nav aria-label="Dashboard sections" className="px-3 pb-3 lg:pb-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const active = item.matches.includes(route.name);
              return (
                <li key={item.label}>
                  <a
                    href={hrefFor(item.route)}
                    aria-current={active ? 'page' : undefined}
                    className={`block whitespace-nowrap rounded px-3 py-1.5 text-sm transition-colors
                      ${active
                        ? 'bg-surface-hover font-medium text-ink'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'}`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className="hidden px-5 pb-5 text-2xs leading-relaxed text-ink-muted lg:absolute lg:bottom-0 lg:block">
          Stored locally on this device.
        </p>
      </header>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
}

/** The product mark, matching the extension icon. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--line-strong)" strokeWidth="5" />
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeDasharray={`${2 * Math.PI * 9.5 * 0.68} ${2 * Math.PI * 9.5}`}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}
