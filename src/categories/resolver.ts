/**
 * Resolving a domain to its category.
 *
 * Precedence, highest first:
 *   1. An explicit user assignment in `Settings.domainCategories`.
 *   2. The seeded catalog mapping.
 *   3. A parent-domain match, so `gist.github.com` inherits `github.com`.
 *   4. The fallback category (`Other`).
 */

import type { Category, CategoryId, Settings } from '../types';
import {
  BRAND_NAMES,
  DEFAULT_DOMAIN_CATEGORIES,
  FALLBACK_CATEGORY_ID,
} from './catalog';
import { NEUTRAL_SLOT } from './palette';
import { fallbackDisplayName } from '../tracking/domain-normalizer';

export function resolveCategoryId(
  domain: string,
  userMappings: Record<string, CategoryId> = {},
): CategoryId {
  const direct = userMappings[domain] ?? DEFAULT_DOMAIN_CATEGORIES[domain];
  if (direct) return direct;

  // Walk up the subdomain chain: `a.b.example.com` tries `b.example.com`,
  // then `example.com`. Stops before bare public suffixes like `com`.
  const labels = domain.split('.');
  for (let i = 1; i <= labels.length - 2; i += 1) {
    const parent = labels.slice(i).join('.');
    const match = userMappings[parent] ?? DEFAULT_DOMAIN_CATEGORIES[parent];
    if (match) return match;
  }

  return FALLBACK_CATEGORY_ID;
}

/** Look up a category record, always returning something renderable. */
export function findCategory(categories: Category[], id: CategoryId): Category {
  return (
    categories.find((c) => c.id === id) ??
    categories.find((c) => c.isFallback) ?? {
      id: FALLBACK_CATEGORY_ID,
      label: 'Other',
      colorIndex: NEUTRAL_SLOT,
      isFallback: true,
    }
  );
}

/** Display label for a domain: curated brand name, else a capitalized label. */
export function domainLabel(domain: string): string {
  return BRAND_NAMES[domain] ?? fallbackDisplayName(domain);
}

/**
 * Convenience wrapper binding a `Settings` object, used by the dashboard where
 * the same settings are applied across hundreds of rows.
 */
export function createCategoryLookup(settings: Settings) {
  const cache = new Map<string, Category>();
  return (domain: string): Category => {
    const cached = cache.get(domain);
    if (cached) return cached;
    const category = findCategory(
      settings.categories,
      resolveCategoryId(domain, settings.domainCategories),
    );
    cache.set(domain, category);
    return category;
  };
}
