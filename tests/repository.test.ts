import { beforeEach, describe, expect, it } from 'vitest';
import { TrackingRepository, aggregate } from '../src/storage/repository';
import { createMemoryStorageArea } from '../src/storage/area';
import { KEYS, parseDayRecord, parseSettings } from '../src/storage/schema';
import { DEFAULT_SETTINGS } from '../src/storage/schema';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe('TrackingRepository', () => {
  let area: ReturnType<typeof createMemoryStorageArea>;
  let repo: TrackingRepository;

  beforeEach(async () => {
    area = createMemoryStorageArea();
    repo = new TrackingRepository(area);
    await repo.initialize(at(2026, 9, 1));
  });

  describe('commitInterval', () => {
    it('records totals, hourly buckets and the session together', async () => {
      await repo.commitInterval('github.com', at(2026, 9, 22, 10, 0), at(2026, 9, 22, 10, 30));
      const day = await repo.getDay('2026-09-22');

      expect(day.totals['github.com']).toBe(30 * 60_000);
      expect(day.hourly[10]).toBe(30 * 60_000);
      expect(day.sessions).toHaveLength(1);
      expect(day.sessions[0]).toMatchObject({ domain: 'github.com', duration: 30 * 60_000 });
    });

    it('accumulates repeat visits into one total but separate sessions', async () => {
      await repo.commitInterval('youtube.com', at(2026, 9, 22, 10, 0), at(2026, 9, 22, 10, 19));
      await repo.commitInterval('youtube.com', at(2026, 9, 22, 12, 4), at(2026, 9, 22, 12, 17));
      const day = await repo.getDay('2026-09-22');

      expect(day.totals['youtube.com']).toBe(32 * 60_000);
      expect(day.sessions).toHaveLength(2);
    });

    it('splits a midnight-spanning session across both days', async () => {
      await repo.commitInterval('youtube.com', at(2026, 9, 22, 23, 58), at(2026, 9, 23, 0, 7));

      const before = await repo.getDay('2026-09-22');
      const after = await repo.getDay('2026-09-23');
      expect(before.totals['youtube.com']).toBe(2 * 60_000);
      expect(after.totals['youtube.com']).toBe(7 * 60_000);
      expect(before.hourly[23]).toBe(2 * 60_000);
      expect(after.hourly[0]).toBe(7 * 60_000);
      expect(before.sessions).toHaveLength(1);
      expect(after.sessions).toHaveLength(1);
    });

    it('ignores intervals that carry no time', async () => {
      await repo.commitInterval('a.com', at(2026, 9, 22, 10), at(2026, 9, 22, 10));
      await repo.commitInterval('a.com', at(2026, 9, 22, 11), at(2026, 9, 22, 10));
      expect(await area.get([KEYS.day('2026-09-22')])).toEqual({});
    });
  });

  describe('settings', () => {
    it('returns defaults on a fresh install', async () => {
      expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('merges a partial update and persists it', async () => {
      await repo.saveSettings({ trackingEnabled: false });
      const fresh = new TrackingRepository(area);
      const settings = await fresh.getSettings();

      expect(settings.trackingEnabled).toBe(false);
      expect(settings.theme).toBe('system');
    });

    it('clamps an out-of-range idle threshold', async () => {
      expect((await repo.saveSettings({ idleThresholdSeconds: 0 })).idleThresholdSeconds).toBe(0);
      expect((await repo.saveSettings({ idleThresholdSeconds: 2 })).idleThresholdSeconds).toBe(15);
      expect((await repo.saveSettings({ idleThresholdSeconds: 99_999 })).idleThresholdSeconds)
        .toBe(900);
    });
  });

  describe('corrupted storage', () => {
    it('degrades a malformed day record to an empty day instead of throwing', async () => {
      await area.set({ [KEYS.day('2026-09-22')]: { totals: 'nonsense', hourly: 7, sessions: 3 } });
      const day = await repo.getDay('2026-09-22');
      expect(day.totals).toEqual({});
      expect(day.hourly).toHaveLength(24);
      expect(day.sessions).toEqual([]);
    });

    it('drops individual invalid entries but keeps the good ones', () => {
      const day = parseDayRecord({
        date: '2026-09-22',
        totals: { 'good.com': 1000, 'bad.com': -5, 'worse.com': 'x' },
        hourly: [1000],
        sessions: [
          { domain: 'good.com', startTime: 1, endTime: 2, duration: 1 },
          { domain: 'bad.com', startTime: 5, endTime: 2, duration: -3 },
          null,
        ],
      }, '2026-09-22');

      expect(day.totals).toEqual({ 'good.com': 1000 });
      expect(day.sessions).toHaveLength(1);
      expect(day.hourly).toHaveLength(24);
    });

    it('falls back to defaults for unusable settings', () => {
      expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(parseSettings({ theme: 'neon', excludedDomains: [1, 'ok'] })).toMatchObject({
        theme: 'system', excludedDomains: ['ok'],
      });
    });
  });

  describe('getRangeStats', () => {
    beforeEach(async () => {
      await repo.commitInterval('github.com', at(2026, 9, 21, 9, 0), at(2026, 9, 21, 10, 0));
      await repo.commitInterval('youtube.com', at(2026, 9, 22, 14, 0), at(2026, 9, 22, 16, 0));
      await repo.commitInterval('github.com', at(2026, 9, 22, 16, 0), at(2026, 9, 22, 16, 30));
    });

    it('totals a range and ranks domains by time', async () => {
      const stats = await repo.getRangeStats('2026-09-21', '2026-09-22');
      expect(stats.totalMs).toBe(3.5 * 3_600_000);
      expect(stats.domains.map((d) => d.domain)).toEqual(['youtube.com', 'github.com']);
      expect(stats.domains[0].ms).toBe(2 * 3_600_000);
    });

    it('groups domains into categories', async () => {
      const stats = await repo.getRangeStats('2026-09-21', '2026-09-22');
      const byId = Object.fromEntries(stats.categories.map((c) => [c.categoryId, c.ms]));
      expect(byId.entertainment).toBe(2 * 3_600_000);
      expect(byId.development).toBe(1.5 * 3_600_000);
    });

    it('includes every date in the range, even empty ones', async () => {
      const stats = await repo.getRangeStats('2026-09-19', '2026-09-22');
      expect(stats.daily.map((d) => d.date)).toEqual([
        '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22',
      ]);
      expect(stats.daily[0].totalMs).toBe(0);
    });

    it('returns a usable empty shape when nothing was recorded', async () => {
      const stats = await repo.getRangeStats('2020-01-01', '2020-01-07');
      expect(stats.totalMs).toBe(0);
      expect(stats.domains).toEqual([]);
      expect(stats.categories).toEqual([]);
      expect(stats.hourly).toHaveLength(24);
      expect(stats.hourly.every((h) => h === 0)).toBe(true);
    });
  });

  describe('prune', () => {
    it('drops raw sessions past the session window but keeps totals', async () => {
      await repo.commitInterval('a.com', at(2026, 8, 1, 10), at(2026, 8, 1, 11));
      await repo.prune('2026-09-22'); // 52 days later, past the 30-day session window

      const day = await repo.getDay('2026-08-01');
      expect(day.sessions).toEqual([]);
      expect(day.totals['a.com']).toBe(3_600_000);
    });

    it('removes whole days past the day-retention window', async () => {
      await repo.commitInterval('a.com', at(2024, 1, 1, 10), at(2024, 1, 1, 11));
      await repo.prune('2026-09-22');
      expect(await area.get([KEYS.day('2024-01-01')])).toEqual({});
    });

    it('leaves recent days untouched', async () => {
      await repo.commitInterval('a.com', at(2026, 9, 21, 10), at(2026, 9, 21, 11));
      await repo.prune('2026-09-22');
      expect((await repo.getDay('2026-09-21')).sessions).toHaveLength(1);
    });

    it('runs at most once per day', async () => {
      await repo.prune('2026-09-22');
      await repo.commitInterval('a.com', at(2024, 1, 1, 10), at(2024, 1, 1, 11));
      const second = await repo.prune('2026-09-22');
      expect(second.pruned).toBe(0);
    });
  });

  describe('data management', () => {
    it('clears activity but keeps settings', async () => {
      await repo.saveSettings({ excludedDomains: ['localhost'] });
      await repo.commitInterval('a.com', at(2026, 9, 22, 10), at(2026, 9, 22, 11));
      await repo.clearTrackingData();

      expect((await repo.getDay('2026-09-22')).totals).toEqual({});
      expect((await repo.getSettings()).excludedDomains).toEqual(['localhost']);
    });

    it('clears everything back to install state', async () => {
      await repo.saveSettings({ excludedDomains: ['localhost'] });
      await repo.commitInterval('a.com', at(2026, 9, 22, 10), at(2026, 9, 22, 11));
      await repo.clearEverything();

      expect((await repo.getSettings()).excludedDomains).toEqual([]);
      expect((await repo.getDay('2026-09-22')).totals).toEqual({});
    });

    it('exports only the fields the extension records', async () => {
      await repo.commitInterval('github.com', at(2026, 9, 22, 10), at(2026, 9, 22, 11));
      const bundle = await repo.exportAll();

      expect(bundle.days).toHaveLength(1);
      expect(Object.keys(bundle.days[0].sessions[0]).sort())
        .toEqual(['domain', 'duration', 'endTime', 'startTime']);
      expect(JSON.stringify(bundle)).not.toContain('http');
    });
  });

  describe('tracker state', () => {
    it('round-trips an in-flight session', async () => {
      const state = { domain: 'github.com', startedAt: 1000, lastHeartbeatAt: 2000 };
      await repo.setTrackerState(state);
      expect(await repo.getTrackerState()).toEqual(state);

      await repo.setTrackerState(null);
      expect(await repo.getTrackerState()).toBeNull();
    });

    it('rejects a malformed snapshot rather than resuming from garbage', async () => {
      await area.set({ [KEYS.trackerState]: { domain: 42 } });
      expect(await repo.getTrackerState()).toBeNull();
    });
  });
});

describe('aggregate', () => {
  it('applies user category overrides ahead of the defaults', () => {
    const settings = { ...DEFAULT_SETTINGS, domainCategories: { 'youtube.com': 'learning' } };
    const stats = aggregate([{
      date: '2026-09-22',
      totals: { 'youtube.com': 60_000 },
      hourly: new Array(24).fill(0),
      sessions: [],
    }], settings);

    expect(stats.categories[0].categoryId).toBe('learning');
  });

  it('files unknown domains under the fallback category', () => {
    const stats = aggregate([{
      date: '2026-09-22',
      totals: { 'some-unknown-site.example': 60_000 },
      hourly: new Array(24).fill(0),
      sessions: [],
    }]);
    expect(stats.categories[0].categoryId).toBe('other');
    expect(stats.categories[0].label).toBe('Other');
  });

  it('inherits a parent domain category for unlisted subdomains', () => {
    const stats = aggregate([{
      date: '2026-09-22',
      totals: { 'gist.github.com': 60_000 },
      hourly: new Array(24).fill(0),
      sessions: [],
    }]);
    expect(stats.categories[0].categoryId).toBe('development');
  });
});
