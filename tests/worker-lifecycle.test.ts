import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from './fake-chrome';
import { Tracker } from '../src/background/tracker';
import { TrackingRepository } from '../src/storage/repository';
import { createMemoryStorageArea } from '../src/storage/area';

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s, 0).getTime();

const MIN = 60_000;

/**
 * Manifest V3 suspends an idle service worker after about 30 seconds. While a
 * user reads one page without generating any tab or window events, the worker
 * is therefore killed and revived repeatedly - the heartbeat alarm is the only
 * thing waking it.
 *
 * Reading a single article for ten minutes must record ten minutes, even though
 * the worker died ten times in the middle of it.
 */
describe('continuous browsing across service-worker suspensions', () => {
  let fake: ReturnType<typeof installFakeChrome>;
  let area: ReturnType<typeof createMemoryStorageArea>;
  let repo: TrackingRepository;

  const T = at(2026, 9, 22, 10, 0);

  beforeEach(() => {
    fake = installFakeChrome();
    area = createMemoryStorageArea();
    repo = new TrackingRepository(area);
  });

  const totals = async () => (await repo.getDay('2026-09-22')).totals;

  it('records the whole time a user spends reading one page', async () => {
    fake.actions.openTab('https://en.wikipedia.org/wiki/Time');

    // The first worker generation starts the session.
    let tracker = new Tracker(repo);
    await tracker.start(T);

    // Ten minutes of reading. No tab events - only the heartbeat alarm, which
    // wakes a fresh worker generation each time because the previous one was
    // suspended in between.
    for (let minute = 1; minute <= 10; minute += 1) {
      tracker = new Tracker(new TrackingRepository(area));
      await tracker.start(T + minute * MIN);
      await tracker.onHeartbeat(T + minute * MIN);
    }

    // The user finally switches away.
    fake.actions.blurBrowser();
    await tracker.reconcile(T + 10 * MIN);

    expect((await totals())['en.wikipedia.org']).toBe(10 * MIN);
  });

  it('does not lose the minute between one heartbeat and the next revival', async () => {
    fake.actions.openTab('https://github.com/');

    const first = new Tracker(repo);
    await first.start(T);
    await first.onHeartbeat(T); // snapshot: startedAt T, heartbeat T

    // Worker dies. The alarm revives it one minute later.
    const second = new Tracker(new TrackingRepository(area));
    await second.start(T + MIN);

    fake.actions.blurBrowser();
    await second.reconcile(T + MIN);

    expect((await totals())['github.com']).toBe(MIN);
  });
});
