/**
 * Folding the in-flight session into displayed statistics.
 *
 * Time is written to storage when a session CLOSES, which keeps writes
 * proportional to how often the user switches sites rather than to how long
 * they browse. The cost is that the session currently running is absent from
 * stored totals until it ends.
 *
 * For the dashboard that is invisible: viewing the dashboard makes an extension
 * page the active tab, so nothing is being tracked and stored totals are
 * already complete. The popup is different - it opens OVER the page being
 * tracked, so without this merge it would show a site's timer ticking in
 * "Currently" while "Today" ignored those same minutes.
 *
 * Pure and range-aware, so it can be tested without a browser.
 */

import type { LiveStatus, RangeStats, Settings } from '../types';
import { splitAcrossDays, addToHourlyBuckets } from './time-calculator';
import { createCategoryLookup } from '../categories/resolver';

/**
 * Return `stats` with the running session added.
 *
 * The session is clipped to the days the range actually covers, so a session
 * that began before midnight contributes only its portion of each day and a
 * range that excludes today is returned untouched.
 */
export function mergeLiveSession(
  stats: RangeStats,
  live: LiveStatus | null,
  settings: Settings,
  now: number = Date.now(),
): RangeStats {
  const current = live?.current;
  if (!current) return stats;

  const slices = splitAcrossDays(current.domain, current.startedAt, now)
    .filter((slice) => stats.dates.includes(slice.date));
  if (slices.length === 0) return stats;

  const addedMs = slices.reduce((sum, slice) => sum + slice.session.duration, 0);

  const hourly = [...stats.hourly];
  const daily = stats.daily.map((day) => ({ ...day }));
  for (const slice of slices) {
    addToHourlyBuckets(hourly, slice.session);
    const day = daily.find((entry) => entry.date === slice.date);
    if (day) day.totalMs += slice.session.duration;
  }

  const categoryOf = createCategoryLookup(settings);
  const category = categoryOf(current.domain);

  const domains = stats.domains.map((entry) => ({ ...entry }));
  const existing = domains.find((entry) => entry.domain === current.domain);
  if (existing) existing.ms += addedMs;
  else domains.push({ domain: current.domain, ms: addedMs, categoryId: category.id });
  domains.sort((a, b) => b.ms - a.ms);

  const categories = stats.categories.map((entry) => ({ ...entry }));
  const existingCategory = categories.find((entry) => entry.categoryId === category.id);
  if (existingCategory) existingCategory.ms += addedMs;
  else {
    categories.push({
      categoryId: category.id,
      label: category.label,
      colorIndex: category.colorIndex,
      ms: addedMs,
    });
  }
  categories.sort((a, b) => b.ms - a.ms);

  return { ...stats, totalMs: stats.totalMs + addedMs, domains, categories, hourly, daily };
}
