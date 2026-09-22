/**
 * Category management.
 *
 * V1 scope: view the categories, and reassign any site that has recorded time.
 * Adding and renaming categories is intentionally left for a later version -
 * the storage model already supports it (`Settings.categories`), so it is a UI
 * addition rather than a migration.
 */
import { useMemo } from 'react';
import type { Settings } from '../../types';
import { useRangeStats, useToday, resolveRange } from '../useStats';
import { createCategoryLookup, domainLabel } from '../../categories/resolver';
import { CategoryDot } from '../../shared/ui/primitives';
import { Favicon } from '../../shared/ui/Favicon';

interface CategoryEditorProps {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
}

export function CategoryEditor({ settings, onSave }: CategoryEditorProps) {
  const today = useToday();
  // Sites seen in the last week are the ones worth offering to reassign.
  const { data: stats } = useRangeStats(useMemo(() => resolveRange('week', today), [today]));
  const categoryOf = createCategoryLookup(settings);

  const reassign = (domain: string, categoryId: string) => {
    void onSave({
      domainCategories: { ...settings.domainCategories, [domain]: categoryId },
    });
  };

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {settings.categories.map((category) => (
          <li key={category.id} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <CategoryDot colorIndex={category.colorIndex} />
            {category.label}
          </li>
        ))}
      </ul>

      {stats && stats.domains.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="panel-heading mb-3">Reassign a website</p>
          <ul className="flex flex-col gap-1">
            {stats.domains.slice(0, 12).map((entry) => {
              const current = categoryOf(entry.domain);
              const selectId = `category-${entry.domain}`;
              return (
                <li key={entry.domain} className="flex items-center justify-between gap-4 py-1">
                  <label
                    htmlFor={selectId}
                    className="flex min-w-0 items-center gap-2 text-sm text-ink"
                  >
                    <Favicon domain={entry.domain} size={16} />
                    <span className="truncate">{domainLabel(entry.domain)}</span>
                  </label>
                  <select
                    id={selectId}
                    value={current.id}
                    onChange={(event) => reassign(entry.domain, event.target.value)}
                    className="shrink-0 rounded border border-control-line bg-surface px-2 py-1
                      text-xs text-ink"
                  >
                    {settings.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
