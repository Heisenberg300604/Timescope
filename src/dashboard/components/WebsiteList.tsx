/**
 * The ranked site list, shared by the overview (top five) and the Websites page
 * (everything). Each row is a link to that site's detail view.
 */
import type { DomainTotal, Settings } from '../../types';
import { formatDuration, formatPercent } from '../../utils/format';
import { createCategoryLookup, domainLabel } from '../../categories/resolver';
import { Favicon } from '../../shared/ui/Favicon';
import { CategoryDot, EmptyState } from '../../shared/ui/primitives';
import { hrefFor } from '../router';

interface WebsiteListProps {
  domains: DomainTotal[];
  totalMs: number;
  settings: Settings;
  /** Cap the list; the overview shows a handful, the full page shows all. */
  limit?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function WebsiteList({
  domains,
  totalMs,
  settings,
  limit,
  emptyTitle = 'No websites yet',
  emptyDescription = 'Sites you visit will be listed here.',
}: WebsiteListProps) {
  const categoryOf = createCategoryLookup(settings);
  const visible = limit ? domains.slice(0, limit) : domains;
  const max = domains[0]?.ms ?? 1;

  if (visible.length === 0) {
    return <EmptyState compact title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="-mx-2">
      {visible.map((entry) => {
        const category = categoryOf(entry.domain);
        return (
          <li key={entry.domain}>
            <a
              href={hrefFor({ name: 'website', domain: entry.domain })}
              className="group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors
                hover:bg-surface-hover"
            >
              <Favicon domain={entry.domain} size={20} />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-ink">{domainLabel(entry.domain)}</span>
                  <span className="tnum shrink-0 text-sm font-medium text-ink">
                    {formatDuration(entry.ms)}
                  </span>
                </span>

                <span className="mt-1 flex items-center gap-3">
                  <span
                    className="h-1 flex-1 overflow-hidden rounded-full bg-surface-hover"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(1, (entry.ms / max) * 100)}%`,
                        background: `var(--cat-${category.colorIndex})`,
                      }}
                    />
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-2xs text-ink-muted">
                    <CategoryDot colorIndex={category.colorIndex} />
                    {category.label}
                    <span aria-hidden="true">·</span>
                    <span className="tnum">{formatPercent(entry.ms, totalMs)}</span>
                  </span>
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
