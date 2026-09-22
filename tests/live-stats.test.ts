import { describe, expect, it } from 'vitest';
import { mergeLiveSession } from '../src/tracking/live-stats';
import { DEFAULT_SETTINGS } from '../src/storage/schema';
import type { LiveStatus, RangeStats } from '../src/types';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

const MIN = 60_000;

const baseStats = (overrides: Partial<RangeStats> = {}): RangeStats => ({
  dates: ['2026-09-22'],
  totalMs: 30 * MIN,
  domains: [{ domain: 'youtube.com', ms: 30 * MIN, categoryId: 'entertainment' }],
  categories: [
    { categoryId: 'entertainment', label: 'Entertainment', colorIndex: 6, ms: 30 * MIN },
  ],
  hourly: new Array(24).fill(0),
  daily: [{ date: '2026-09-22', totalMs: 30 * MIN }],
  ...overrides,
});

const live = (domain: string, startedAt: number): LiveStatus => ({
  trackingEnabled: true,
  current: { domain, startedAt, elapsed: 0 },
  reason: null,
});

describe('mergeLiveSession', () => {
  it('adds the running session to the total', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('github.com', at(2026, 9, 22, 10, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 5),
    );
    expect(merged.totalMs).toBe(35 * MIN);
  });

  it('adds a new site to the ranked list', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('github.com', at(2026, 9, 22, 10, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 5),
    );
    expect(merged.domains.find((d) => d.domain === 'github.com')?.ms).toBe(5 * MIN);
  });

  it('accumulates onto a site that already has recorded time', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('youtube.com', at(2026, 9, 22, 10, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 5),
    );
    expect(merged.domains).toHaveLength(1);
    expect(merged.domains[0].ms).toBe(35 * MIN);
  });

  it('keeps the ranking ordered by time', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('github.com', at(2026, 9, 22, 8, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 0),
    );
    expect(merged.domains.map((d) => d.domain)).toEqual(['github.com', 'youtube.com']);
  });

  it('credits the running session to its category', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('github.com', at(2026, 9, 22, 10, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 5),
    );
    expect(merged.categories.find((c) => c.categoryId === 'development')?.ms).toBe(5 * MIN);
  });

  it('fills the hourly buckets the session actually spans', () => {
    const merged = mergeLiveSession(
      baseStats(),
      live('github.com', at(2026, 9, 22, 9, 50)),
      DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 20),
    );
    expect(merged.hourly[9]).toBe(10 * MIN);
    expect(merged.hourly[10]).toBe(20 * MIN);
  });

  it('counts only the portion inside the range when a session spans midnight', () => {
    const merged = mergeLiveSession(
      baseStats({ dates: ['2026-09-23'], daily: [{ date: '2026-09-23', totalMs: 0 }], totalMs: 0,
        domains: [], categories: [] }),
      live('github.com', at(2026, 9, 22, 23, 50)),
      DEFAULT_SETTINGS,
      at(2026, 9, 23, 0, 10),
    );
    // Only the ten minutes after midnight belong to the 23rd.
    expect(merged.totalMs).toBe(10 * MIN);
  });

  it('returns the range untouched when it does not include the session', () => {
    const stats = baseStats();
    const merged = mergeLiveSession(
      stats,
      live('github.com', at(2026, 9, 25, 10, 0)),
      DEFAULT_SETTINGS,
      at(2026, 9, 25, 10, 5),
    );
    expect(merged).toBe(stats);
  });

  it('is a no-op when nothing is being tracked', () => {
    const stats = baseStats();
    expect(mergeLiveSession(stats, null, DEFAULT_SETTINGS)).toBe(stats);
    expect(
      mergeLiveSession(stats, { trackingEnabled: false, current: null, reason: 'paused' },
        DEFAULT_SETTINGS),
    ).toBe(stats);
  });

  it('does not mutate the statistics it was given', () => {
    const stats = baseStats();
    mergeLiveSession(stats, live('github.com', at(2026, 9, 22, 10, 0)), DEFAULT_SETTINGS,
      at(2026, 9, 22, 10, 5));
    expect(stats.totalMs).toBe(30 * MIN);
    expect(stats.domains).toHaveLength(1);
  });
});
