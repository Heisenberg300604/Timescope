import { describe, expect, it } from 'vitest';
import {
  addToHourlyBuckets,
  emptyHourly,
  splitAcrossDays,
} from '../src/tracking/time-calculator';

/** Local-time helper so these tests read as wall-clock, not epoch arithmetic. */
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s, 0).getTime();

describe('splitAcrossDays', () => {
  it('keeps a same-day session whole', () => {
    const slices = splitAcrossDays('github.com', at(2026, 9, 22, 10, 0), at(2026, 9, 22, 11, 30));
    expect(slices).toHaveLength(1);
    expect(slices[0].date).toBe('2026-09-22');
    expect(slices[0].session.duration).toBe(90 * 60_000);
  });

  it('splits a session that crosses midnight into two days', () => {
    const slices = splitAcrossDays('youtube.com', at(2026, 9, 22, 23, 58), at(2026, 9, 23, 0, 7));
    expect(slices.map((s) => s.date)).toEqual(['2026-09-22', '2026-09-23']);
    expect(slices[0].session.duration).toBe(2 * 60_000);
    expect(slices[1].session.duration).toBe(7 * 60_000);
    // No time is created or lost by the split.
    const total = slices.reduce((sum, s) => sum + s.session.duration, 0);
    expect(total).toBe(9 * 60_000);
  });

  it('splits a multi-day session at every midnight', () => {
    const slices = splitAcrossDays('x.com', at(2026, 9, 22, 22, 0), at(2026, 9, 25, 3, 0));
    expect(slices.map((s) => s.date)).toEqual([
      '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
    ]);
    expect(slices[1].session.duration).toBe(24 * 3_600_000);
  });

  it('produces no slice for inverted, empty or invalid intervals', () => {
    expect(splitAcrossDays('a.com', at(2026, 9, 22, 12), at(2026, 9, 22, 11))).toEqual([]);
    expect(splitAcrossDays('a.com', 1000, 1000)).toEqual([]);
    expect(splitAcrossDays('a.com', Number.NaN, 5000)).toEqual([]);
    expect(splitAcrossDays('a.com', 0, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('drops sub-second remainders rather than recording noise', () => {
    const start = at(2026, 9, 22, 23, 59, 59) + 500;
    const slices = splitAcrossDays('a.com', start, at(2026, 9, 23, 0, 30));
    expect(slices.map((s) => s.date)).toEqual(['2026-09-23']);
  });

  it('never emits a negative duration', () => {
    const slices = splitAcrossDays('a.com', at(2026, 9, 22, 10), at(2026, 9, 24, 10));
    for (const s of slices) expect(s.session.duration).toBeGreaterThan(0);
  });
});

describe('addToHourlyBuckets', () => {
  it('distributes a session across the hours it actually spans', () => {
    const buckets = emptyHourly();
    addToHourlyBuckets(buckets, {
      domain: 'a.com',
      startTime: at(2026, 9, 22, 9, 50),
      endTime: at(2026, 9, 22, 10, 30),
      duration: 40 * 60_000,
    });
    expect(buckets[9]).toBe(10 * 60_000);
    expect(buckets[10]).toBe(30 * 60_000);
    expect(buckets[8]).toBe(0);
  });

  it('conserves total duration across buckets', () => {
    const buckets = emptyHourly();
    const start = at(2026, 9, 22, 6, 17);
    const end = at(2026, 9, 22, 19, 43);
    addToHourlyBuckets(buckets, {
      domain: 'a.com', startTime: start, endTime: end, duration: end - start,
    });
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(end - start);
  });

  it('places a session entirely inside one hour in a single bucket', () => {
    const buckets = emptyHourly();
    addToHourlyBuckets(buckets, {
      domain: 'a.com',
      startTime: at(2026, 9, 22, 14, 5),
      endTime: at(2026, 9, 22, 14, 35),
      duration: 30 * 60_000,
    });
    expect(buckets[14]).toBe(30 * 60_000);
    expect(buckets.filter((b) => b > 0)).toHaveLength(1);
  });

  it('has exactly 24 buckets', () => {
    expect(emptyHourly()).toHaveLength(24);
  });
});
