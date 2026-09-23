import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from './fake-chrome';
import { Tracker } from '../src/background/tracker';
import { TrackingRepository } from '../src/storage/repository';
import { createMemoryStorageArea } from '../src/storage/area';
import { KEYS } from '../src/storage/schema';

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s, 0).getTime();

const MIN = 60_000;

describe('Tracker', () => {
  let fake: ReturnType<typeof installFakeChrome>;
  let area: ReturnType<typeof createMemoryStorageArea>;
  let repo: TrackingRepository;
  let tracker: Tracker;

  const T = at(2026, 9, 22, 10, 0);

  beforeEach(async () => {
    fake = installFakeChrome();
    area = createMemoryStorageArea();
    repo = new TrackingRepository(area);
    tracker = new Tracker(repo);
  });

  /** Start the tracker with one tab already open and focused. */
  async function boot(url = 'https://github.com/user/repo', now = T) {
    fake.actions.openTab(url);
    await tracker.start(now);
  }

  const totals = async (date = '2026-09-22') => (await repo.getDay(date)).totals;

  it('opens a session for the focused tab on start-up', async () => {
    await boot();
    expect((await repo.getTrackerState())?.domain).toBe('github.com');
  });

  it('ends one session and starts another on a tab switch', async () => {
    fake.actions.openTab('https://youtube.com/watch?v=1');
    await tracker.start(T);

    const tab2 = fake.actions.openTab('https://github.com/user/repo');
    fake.actions.switchToTab(tab2);
    await tracker.reconcile(T + 19 * MIN);

    expect(await totals()).toEqual({ 'youtube.com': 19 * MIN });
    expect((await repo.getTrackerState())?.domain).toBe('github.com');
  });

  it('does not count a background tab', async () => {
    const youtube = fake.actions.openTab('https://youtube.com/');
    await tracker.start(T);

    const github = fake.actions.openTab('https://github.com/');
    fake.actions.switchToTab(github);
    await tracker.reconcile(T + 10 * MIN);
    // YouTube is still open, just not in front.
    await tracker.reconcile(T + 40 * MIN);

    expect(await totals()).toEqual({ 'youtube.com': 10 * MIN });
    expect(fake.state.tabs.find((t) => t.id === youtube)?.url).toContain('youtube');
  });

  it('stops counting when the browser loses focus', async () => {
    await boot();
    fake.actions.blurBrowser();
    await tracker.reconcile(T + 12 * MIN);

    expect(await totals()).toEqual({ 'github.com': 12 * MIN });
    expect(await repo.getTrackerState()).toBeNull();
  });

  it('resumes counting when focus returns, without crediting the gap', async () => {
    await boot();
    fake.actions.blurBrowser();
    await tracker.reconcile(T + 12 * MIN);

    fake.actions.focusWindow();
    await tracker.reconcile(T + 50 * MIN);
    await tracker.reconcile(T + 55 * MIN); // still there five minutes later
    fake.actions.blurBrowser();
    await tracker.reconcile(T + 60 * MIN);

    // 12 minutes before the blur, 10 after the return; the 38-minute gap is not counted.
    expect(await totals()).toEqual({ 'github.com': 22 * MIN });
  });

  describe('idle', () => {
    it('keeps recording a focused video when inactivity pausing is disabled', async () => {
      await boot('https://www.netflix.com/watch/123');
      await repo.saveSettings({ idleThresholdSeconds: 0 });
      await tracker.onSettingsChanged(T);

      // Netflix can play for a long time with no mouse or keyboard input.
      fake.actions.setIdle('idle');
      await tracker.onIdleStateChanged('idle', T + 30 * MIN);
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 30 * MIN);

      expect(await totals()).toEqual({ 'netflix.com': 30 * MIN });
    });

    it('stops counting after the idle threshold and backdates to when the user left', async () => {
      await boot('https://youtube.com/watch?v=1');

      // The event arrives 60s after the user actually stopped interacting.
      fake.actions.setIdle('idle');
      await tracker.onIdleStateChanged('idle', T + 21 * MIN);

      // Credited 20 minutes, not 21: the final idle minute was not activity.
      expect(await totals()).toEqual({ 'youtube.com': 20 * MIN });
    });

    it('does not count a 45-minute absence', async () => {
      await boot('https://youtube.com/watch?v=1');
      fake.actions.setIdle('idle');
      await tracker.onIdleStateChanged('idle', T + 6 * MIN);

      fake.actions.setIdle('active');
      await tracker.onIdleStateChanged('active', T + 50 * MIN);
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 55 * MIN);

      expect(await totals()).toEqual({ 'youtube.com': 10 * MIN });
    });

    it('treats a locked screen as idle', async () => {
      await boot();
      fake.actions.setIdle('locked');
      await tracker.onIdleStateChanged('locked', T + 10 * MIN);
      expect(await repo.getTrackerState()).toBeNull();
    });
  });

  describe('service worker restart', () => {
    it('credits time up to the last heartbeat, never past it', async () => {
      await boot();
      await tracker.onHeartbeat(T + 5 * MIN);

      // Worker dies here. A new generation starts an hour later.
      const revived = new Tracker(new TrackingRepository(area));
      await revived.start(T + 65 * MIN);

      // Only the verified five minutes are credited, not the lost hour.
      expect((await totals())['github.com']).toBe(5 * MIN);
    });

    it('does not duplicate the session it recovered', async () => {
      await boot();
      await tracker.onHeartbeat(T + 5 * MIN);

      const revived = new Tracker(new TrackingRepository(area));
      await revived.start(T + 65 * MIN);
      const day = await repo.getDay('2026-09-22');

      expect(day.sessions).toHaveLength(1);
      expect(day.sessions[0].duration).toBe(5 * MIN);
    });

    it('re-derives the live session from the browser after recovery', async () => {
      await boot();
      await tracker.onHeartbeat(T + 5 * MIN);

      const github = fake.state.tabs[0].id;
      fake.actions.navigate(github, 'https://youtube.com/watch?v=1');

      const revived = new Tracker(new TrackingRepository(area));
      await revived.start(T + 65 * MIN);

      expect((await repo.getTrackerState())?.domain).toBe('youtube.com');
    });

    it('recovers cleanly when nothing was in flight', async () => {
      await boot();
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 10 * MIN);

      const revived = new Tracker(new TrackingRepository(area));
      await revived.start(T + 65 * MIN);

      expect((await totals())['github.com']).toBe(10 * MIN);
    });
  });

  describe('browser restart', () => {
    it('keeps previously recorded sessions and starts a fresh one', async () => {
      await boot('https://github.com/');
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 30 * MIN);

      // Browser quits and reopens on a different site.
      fake.actions.closeAllTabs();
      const revived = new Tracker(new TrackingRepository(area));
      fake.actions.openTab('https://youtube.com/');
      await revived.start(T + 60 * MIN);

      expect((await totals())['github.com']).toBe(30 * MIN);
      expect((await repo.getTrackerState())?.domain).toBe('youtube.com');
    });
  });

  describe('midnight', () => {
    it('splits an in-flight session across the day boundary', async () => {
      fake.actions.openTab('https://youtube.com/');
      const beforeMidnight = at(2026, 9, 22, 23, 58);
      await tracker.start(beforeMidnight);

      await tracker.onMidnight(at(2026, 9, 23, 0, 0, 5));
      fake.actions.blurBrowser();
      await tracker.reconcile(at(2026, 9, 23, 0, 7));

      // The boundary itself belongs to the new day: 23:58-00:00 on the 22nd,
      // 00:00-00:07 on the 23rd, with no millisecond counted twice or lost.
      expect((await totals('2026-09-22'))['youtube.com']).toBe(2 * MIN);
      expect((await totals('2026-09-23'))['youtube.com']).toBe(7 * MIN);
    });

    it('keeps tracking the same site after the rollover', async () => {
      fake.actions.openTab('https://youtube.com/');
      await tracker.start(at(2026, 9, 22, 23, 58));
      await tracker.onMidnight(at(2026, 9, 23, 0, 0, 5));

      expect((await repo.getTrackerState())?.domain).toBe('youtube.com');
    });

    it('reschedules itself for the following night', async () => {
      await boot();
      fake.state.alarms.delete('timescope:midnight');
      await tracker.onMidnight(at(2026, 9, 23, 0, 0, 5));
      expect(fake.state.alarms.has('timescope:midnight')).toBe(true);
    });
  });

  describe('heartbeat', () => {
    it('writes nothing when no session is open', async () => {
      await boot();
      fake.actions.blurBrowser();
      await tracker.reconcile(T + MIN);

      const before = area.snapshot();
      await tracker.onHeartbeat(T + 2 * MIN);
      expect(area.snapshot()).toEqual(before);
    });

    it('advances the recovery high-water mark while a session runs', async () => {
      await boot();
      await tracker.onHeartbeat(T + 3 * MIN);
      expect((await repo.getTrackerState())?.lastHeartbeatAt).toBe(T + 3 * MIN);
    });
  });

  describe('settings', () => {
    it('stops tracking when paused and resumes when re-enabled', async () => {
      await boot();
      await repo.saveSettings({ trackingEnabled: false });
      await tracker.onSettingsChanged(T + 10 * MIN);

      expect(await repo.getTrackerState()).toBeNull();
      expect((await totals())['github.com']).toBe(10 * MIN);

      await repo.saveSettings({ trackingEnabled: true });
      await tracker.onSettingsChanged(T + 20 * MIN);
      expect((await repo.getTrackerState())?.domain).toBe('github.com');
    });

    it('stops tracking a domain as soon as it is excluded', async () => {
      await boot('http://localhost:3000/app');
      await repo.saveSettings({ excludedDomains: ['localhost'] });
      await tracker.onSettingsChanged(T + 5 * MIN);

      expect(await repo.getTrackerState()).toBeNull();
      expect((await totals())['localhost:3000']).toBe(5 * MIN);
    });

    it('applies a changed idle threshold to the browser', async () => {
      await boot();
      await repo.saveSettings({ idleThresholdSeconds: 300 });
      await tracker.onSettingsChanged(T + MIN);
      expect(fake.state.idleDetectionInterval).toBe(300);
    });
  });

  describe('untrackable pages', () => {
    it('records nothing for browser-internal pages', async () => {
      await boot('chrome://extensions');
      await tracker.reconcile(T + 10 * MIN);
      expect(await repo.getTrackerState()).toBeNull();
      expect(await totals()).toEqual({});
    });

    it('resumes when the user navigates back to a real site', async () => {
      const tab = fake.actions.openTab('chrome://extensions');
      await tracker.start(T);
      fake.actions.navigate(tab, 'https://github.com/');
      await tracker.reconcile(T);
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 5 * MIN);

      expect((await totals())['github.com']).toBe(5 * MIN);
    });
  });

  describe('rapid tab switching', () => {
    it('produces no double counting, overlaps or negative durations', async () => {
      const tabs = [
        fake.actions.openTab('https://a.com/'),
        fake.actions.openTab('https://b.com/'),
        fake.actions.openTab('https://c.com/'),
      ];
      fake.actions.switchToTab(tabs[0]);
      await tracker.start(T);

      const order = [1, 2, 0, 1, 0, 2, 1, 0];
      for (let i = 0; i < order.length; i += 1) {
        fake.actions.switchToTab(tabs[order[i]]);
        await tracker.reconcile(T + (i + 1) * 5_000);
      }
      fake.actions.blurBrowser();
      await tracker.reconcile(T + (order.length + 1) * 5_000);

      const day = await repo.getDay('2026-09-22');
      const sum = Object.values(day.totals).reduce((a, b) => a + b, 0);
      expect(sum).toBe((order.length + 1) * 5_000);
      for (const s of day.sessions) expect(s.duration).toBeGreaterThan(0);

      // No two recorded sessions overlap in time.
      const sorted = [...day.sessions].sort((a, b) => a.startTime - b.startTime);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].startTime).toBeGreaterThanOrEqual(sorted[i - 1].endTime);
      }
    });

    it('treats the same site in two tabs as one continuous session', async () => {
      const first = fake.actions.openTab('https://youtube.com/watch?v=1');
      const second = fake.actions.openTab('https://youtube.com/watch?v=2');
      fake.actions.switchToTab(first);
      await tracker.start(T);

      fake.actions.switchToTab(second);
      await tracker.reconcile(T + 10 * MIN);
      fake.actions.switchToTab(first);
      await tracker.reconcile(T + 20 * MIN);
      fake.actions.blurBrowser();
      await tracker.reconcile(T + 30 * MIN);

      const day = await repo.getDay('2026-09-22');
      expect(day.totals['youtube.com']).toBe(30 * MIN);
      expect(day.sessions).toHaveLength(1);
    });
  });

  describe('live status', () => {
    it('reports the running session', async () => {
      await boot();
      const status = await tracker.getLiveStatus(T + 34 * MIN);
      expect(status).toMatchObject({
        trackingEnabled: true,
        current: { domain: 'github.com', elapsed: 34 * MIN },
        reason: null,
      });
    });

    it('explains why nothing is being counted', async () => {
      await boot();
      fake.actions.blurBrowser();
      await tracker.reconcile(T + MIN);

      const status = await tracker.getLiveStatus(T + 2 * MIN);
      expect(status.current).toBeNull();
      expect(status.reason).toBe('window-unfocused');
    });
  });

  it('survives a tab vanishing mid-query', async () => {
    await boot();
    fake.api.tabs.query.mockRejectedValueOnce(new Error('tab closed'));
    await expect(tracker.reconcile(T + MIN)).resolves.toBeUndefined();
  });

  it('keeps no raw URLs anywhere in storage', async () => {
    await boot('https://github.com/user/private-repo?token=secret#section');
    fake.actions.blurBrowser();
    await tracker.reconcile(T + 5 * MIN);

    const dump = JSON.stringify(area.snapshot());
    expect(dump).not.toContain('private-repo');
    expect(dump).not.toContain('secret');
    expect(dump).not.toContain('https://');
    expect(dump).toContain('github.com');
    expect(Object.keys(area.snapshot())).toContain(KEYS.day('2026-09-22'));
  });
});
