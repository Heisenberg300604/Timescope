/**
 * Time by category.
 *
 * A horizontal bar chart rather than a donut: the task is comparing magnitudes
 * across a ranked list, which bars do precisely and a donut does by eye. It
 * also lets every row carry its own label and value, so category identity never
 * depends on matching a color to a legend.
 */
import type { CategoryTotal } from '../../types';
import { formatDuration, formatPercent } from '../../utils/format';
import { EmptyState } from '../../shared/ui/primitives';

interface CategoryBarsProps {
  categories: CategoryTotal[];
  totalMs: number;
}

export function CategoryBars({ categories, totalMs }: CategoryBarsProps) {
  if (categories.length === 0) {
    return <EmptyState compact title="No activity yet" description="Categories appear once time is recorded." />;
  }

  const max = categories[0]?.ms ?? 1;

  return (
    <ul className="flex flex-col gap-3">
      {categories.map((category) => (
        <li key={category.categoryId} className="group">
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm text-ink">{category.label}</span>
            <span className="tnum shrink-0 text-sm text-ink-secondary">
              {formatDuration(category.ms)}
              <span className="ml-2 text-ink-muted">{formatPercent(category.ms, totalMs)}</span>
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
            role="img"
            aria-label={`${category.label}: ${formatDuration(category.ms)}, ${formatPercent(category.ms, totalMs)} of total`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(2, (category.ms / max) * 100)}%`,
                background: `var(--cat-${category.colorIndex})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
