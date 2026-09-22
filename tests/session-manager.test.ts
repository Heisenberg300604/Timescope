import { beforeEach, describe, expect, it } from 'vitest';
import {
  SessionManager,
  resolveTarget,
  type TrackingInput,
} from '../src/tracking/session-manager';

const baseInput: TrackingInput = {
  activeUrl: 'https://github.com/user/repo',
  windowFocused: true,
  idleState: 'active',
  trackingEnabled: true,
  excludedDomains: [],
};

const input = (patch: Partial<TrackingInput> = {}): TrackingInput => ({ ...baseInput, ...patch });

describe('resolveTarget', () => {
  it('counts the active tab of a focused window', () => {
    expect(resolveTarget(input())).toEqual({ domain: 'github.com', reason: null });
  });

  it('stops when tracking is paused', () => {
    expect(resolveTarget(input({ trackingEnabled: false }))).toEqual({
      domain: null, reason: 'paused',
    });
  });

  it('stops when the user is idle or the screen is locked', () => {
    expect(resolveTarget(input({ idleState: 'idle' })).domain).toBeNull();
    expect(resolveTarget(input({ idleState: 'locked' })).domain).toBeNull();
    expect(resolveTarget(input({ idleState: 'idle' })).reason).toBe('user-idle');
  });

  it('stops when no browser window holds focus', () => {
    expect(resolveTarget(input({ windowFocused: false }))).toEqual({
      domain: null, reason: 'window-unfocused',
    });
  });

  it('stops on excluded domains', () => {
    const target = resolveTarget(input({
      activeUrl: 'http://localhost:3000/',
      excludedDomains: ['localhost'],
    }));
    expect(target).toEqual({ domain: null, reason: 'excluded' });
  });

  it('stops on untrackable pages', () => {
    expect(resolveTarget(input({ activeUrl: 'chrome://extensions' })).reason).toBe('untrackable');
    expect(resolveTarget(input({ activeUrl: null })).reason).toBe('untrackable');
  });

  it('reports pause ahead of every other reason', () => {
    const target = resolveTarget(input({
      trackingEnabled: false, windowFocused: false, idleState: 'idle', activeUrl: null,
    }));
    expect(target.reason).toBe('paused');
  });
});

describe('SessionManager', () => {
  let manager: SessionManager;
  const T = 1_700_000_000_000;

  beforeEach(() => {
    manager = new SessionManager();
  });

  const go = (domain: string | null, now: number) =>
    manager.transitionTo({ domain, reason: domain ? null : 'untrackable' }, now);

  it('opens a session on first activation', () => {
    const result = go('github.com', T);
    expect(result.completed).toBeNull();
    expect(manager.current).toMatchObject({ domain: 'github.com', startedAt: T });
  });

  it('ends the old session and starts a new one on a tab switch', () => {
    go('youtube.com', T);
    const result = go('github.com', T + 60_000);

    expect(result.completed).toEqual({
      domain: 'youtube.com', startTime: T, endTime: T + 60_000,
    });
    expect(manager.current).toMatchObject({ domain: 'github.com', startedAt: T + 60_000 });
  });

  it('stops counting when the window loses focus', () => {
    go('github.com', T);
    const result = go(null, T + 30_000);

    expect(result.completed).toEqual({
      domain: 'github.com', startTime: T, endTime: T + 30_000,
    });
    expect(manager.current).toBeNull();
  });

  it('resumes into a fresh session when focus returns', () => {
    go('github.com', T);
    go(null, T + 30_000);
    const result = go('github.com', T + 5 * 60_000);

    expect(result.completed).toBeNull();
    expect(manager.current).toMatchObject({ domain: 'github.com', startedAt: T + 5 * 60_000 });
  });

  it('does not count the gap while the user is away', () => {
    go('youtube.com', T);
    const away = go(null, T + 10 * 60_000);      // user goes idle
    const back = go('youtube.com', T + 55 * 60_000); // returns 45 minutes later

    expect(away.completed!.endTime - away.completed!.startTime).toBe(10 * 60_000);
    expect(back.completed).toBeNull();
    // The 45 idle minutes produced no interval at all.
  });

  describe('the same site open in several tabs', () => {
    it('treats switching between them as one continuous session', () => {
      go('youtube.com', T);                        // tab 1
      const result = go('youtube.com', T + 30_000); // tab 2, same domain

      expect(result.completed).toBeNull();
      expect(result.changed).toBe(false);
      expect(manager.current).toMatchObject({ domain: 'youtube.com', startedAt: T });
    });

    it('records the full span exactly once', () => {
      go('youtube.com', T);
      go('youtube.com', T + 30_000);
      go('youtube.com', T + 60_000);
      const result = go('github.com', T + 90_000);

      expect(result.completed).toEqual({
        domain: 'youtube.com', startTime: T, endTime: T + 90_000,
      });
    });
  });

  describe('rapid tab switching', () => {
    it('never double counts, overlaps or goes negative', () => {
      const domains = ['a.com', 'b.com', 'c.com', 'a.com', 'b.com', 'a.com', 'c.com'];
      const completed: { domain: string; startTime: number; endTime: number }[] = [];

      domains.forEach((domain, i) => {
        const result = go(domain, T + i * 2_000);
        if (result.completed) completed.push(result.completed);
      });
      const final = manager.transitionTo({ domain: null, reason: 'paused' },
        T + domains.length * 2_000);
      if (final.completed) completed.push(final.completed);

      for (const interval of completed) {
        expect(interval.endTime).toBeGreaterThan(interval.startTime);
      }
      // Intervals tile the timeline without gaps or overlaps.
      for (let i = 1; i < completed.length; i += 1) {
        expect(completed[i].startTime).toBe(completed[i - 1].endTime);
      }
      const total = completed.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);
      expect(total).toBe(domains.length * 2_000);
    });

    it('discards switches faster than the one-second floor', () => {
      go('a.com', T);
      const result = go('b.com', T + 400); // flicked past a tab
      expect(result.completed).toBeNull();
      expect(manager.current!.domain).toBe('b.com');
    });
  });

  describe('service worker restart', () => {
    it('adopts the persisted session and continues it', () => {
      const persisted = { domain: 'github.com', startedAt: T, lastHeartbeatAt: T + 120_000 };
      manager.adopt(persisted);

      expect(manager.current).toEqual(persisted);
      const result = go('github.com', T + 130_000);
      expect(result.completed).toBeNull();
      expect(result.changed).toBe(false);
    });

    it('closes the adopted session when the user has moved on', () => {
      manager.adopt({ domain: 'github.com', startedAt: T, lastHeartbeatAt: T + 120_000 });
      const result = go('youtube.com', T + 130_000);

      expect(result.completed).toEqual({
        domain: 'github.com', startTime: T, endTime: T + 130_000,
      });
    });

    it('starts clean when there was nothing in flight', () => {
      manager.adopt(null);
      expect(manager.current).toBeNull();
      expect(go('github.com', T).completed).toBeNull();
    });
  });

  describe('heartbeat', () => {
    it('advances the high-water mark used by crash recovery', () => {
      go('github.com', T);
      const state = manager.heartbeat(T + 60_000);
      expect(state).toMatchObject({ startedAt: T, lastHeartbeatAt: T + 60_000 });
    });

    it('does nothing when idle', () => {
      expect(manager.heartbeat(T)).toBeNull();
    });
  });

  describe('flush', () => {
    it('closes the session and reopens it, for the midnight rollover', () => {
      go('youtube.com', T);
      const completed = manager.flush(T + 3_600_000);

      expect(completed).toEqual({
        domain: 'youtube.com', startTime: T, endTime: T + 3_600_000,
      });
      // Still tracking the same site, now in a session that starts after midnight.
      expect(manager.current).toMatchObject({
        domain: 'youtube.com', startedAt: T + 3_600_000,
      });
    });

    it('is a no-op when nothing is open', () => {
      expect(manager.flush(T)).toBeNull();
      expect(manager.current).toBeNull();
    });
  });

  it('drops an interval if the system clock moves backwards', () => {
    go('github.com', T);
    const result = go(null, T - 60_000);
    expect(result.completed).toBeNull();
  });

  it('reports why it is not counting', () => {
    manager.transitionTo({ domain: null, reason: 'paused' }, T);
    expect(manager.idleReason).toBe('paused');
    manager.transitionTo({ domain: 'github.com', reason: null }, T + 1000);
    expect(manager.idleReason).toBeNull();
  });
});
