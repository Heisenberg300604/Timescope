/**
 * The tracking engine: browser events in, persisted sessions out.
 *
 * Responsibilities kept deliberately narrow - decide nothing, coordinate
 * everything. `SessionManager` owns the state machine, `TrackingRepository`
 * owns storage, and this class wires them to the browser.
 *
 * Three properties drive the design:
 *
 *   Serialized.  Every event runs through one promise chain. Chrome can deliver
 *                `onActivated` and `onFocusChanged` in the same tick, and both
 *                need to read storage; interleaving them would let two handlers
 *                observe the same stale state and write conflicting sessions.
 *
 *   Event-driven. Nothing polls. The only timer is a one-minute heartbeat that
 *                does no work unless a session is open.
 *
 *   Restart-safe. The open session is mirrored to storage on every transition
 *                and every heartbeat, so a suspended or crashed worker resumes
 *                without losing or duplicating time.
 */

import type { LiveStatus, PersistedTrackerState } from '../types';
import { TrackingRepository } from '../storage/repository';
import { SessionManager, resolveTarget, type TrackingInput } from '../tracking/session-manager';
import { toDateKey } from '../utils/date';

/**
 * How often an open session confirms it is still alive.
 *
 * This is the ONLY recurring timer in the extension, and it returns immediately
 * when nothing is being tracked. It exists so that an unclean shutdown can be
 * reconciled: recovery credits time only up to the last heartbeat, capping any
 * over-count at one interval. `chrome.alarms` does not fire faster than once a
 * minute in a released extension, so one minute is also the floor.
 */
export const HEARTBEAT_MINUTES = 1;

export const ALARM_HEARTBEAT = 'timescope:heartbeat';
export const ALARM_MIDNIGHT = 'timescope:midnight';

export class Tracker {
  private readonly repo: TrackingRepository;
  private readonly sessions = new SessionManager();

  /** Tail of the serialized work queue. Every handler appends to it. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Cached OS idle state. `chrome.idle.queryState` costs a round trip and the
   * state only changes via an event we already listen to, so we mirror it.
   */
  private idleState: 'active' | 'idle' | 'locked' = 'active';

  private started = false;

  constructor(repo: TrackingRepository) {
    this.repo = repo;
  }

  /**
   * Serialize work onto the queue.
   *
   * A failure in one handler must not break the chain for the next, so errors
   * are contained here rather than rejecting the shared promise.
   */
  private enqueue<T>(work: () => Promise<T>): Promise<T | undefined> {
    const next = this.queue.then(work, work).catch((error) => {
      console.error('[TimeScope] tracker task failed', error);
      return undefined;
    });
    this.queue = next;
    return next;
  }

  // -- lifecycle -------------------------------------------------------------

  /**
   * Bring the tracker up, whether from install, browser start, or the service
   * worker being revived after suspension.
   */
  async start(now: number = Date.now()): Promise<void> {
    if (this.started) return;
    this.started = true;

    await this.enqueue(async () => {
      await this.repo.initialize();
      const settings = await this.repo.getSettings();

      // Chrome clamps this to a 15s minimum; settings clamp to the same floor.
      chrome.idle.setDetectionInterval(settings.idleThresholdSeconds);
      this.idleState = await queryIdleState(settings.idleThresholdSeconds);

      await this.recoverInterruptedSession();
      await this.scheduleAlarms(now);
      // Called directly, not via `reconcile()`: we are already inside the
      // queue, and enqueuing from within a queued task would deadlock.
      await this.reconcileNow(now);
    });
  }

  /**
   * Settle an open session left behind by a previous worker generation.
   *
   * The session is credited up to its last heartbeat rather than to now,
   * because everything after that point is unverified: the browser may have
   * been closed, the machine asleep, or the worker dead for hours.
   */
  private async recoverInterruptedSession(): Promise<void> {
    const persisted = await this.repo.getTrackerState();
    if (!persisted) return;

    await this.repo.setTrackerState(null);
    await this.repo.commitInterval(
      persisted.domain,
      persisted.startedAt,
      persisted.lastHeartbeatAt,
    );
    // State is NOT adopted: `reconcile()` re-derives the truth from the browser
    // a moment later, which is what prevents a duplicate session here.
  }

  private async scheduleAlarms(now: number): Promise<void> {
    await chrome.alarms.clear(ALARM_HEARTBEAT);
    chrome.alarms.create(ALARM_HEARTBEAT, { periodInMinutes: HEARTBEAT_MINUTES });
    await this.scheduleMidnightAlarm(now);
  }

  /**
   * Fire just after the next local midnight so a session in progress is split
   * onto the correct day even if the user never touches the browser.
   *
   * Scheduled by absolute time rather than a 24-hour period, so it stays
   * correct across daylight-saving changes and machine sleep.
   */
  private async scheduleMidnightAlarm(now: number): Promise<void> {
    const today = new Date(now);
    // Five seconds past midnight, so the alarm cannot land a hair early and
    // attribute the split to the day that is ending.
    const midnight = new Date(
      today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 5, 0,
    ).getTime();
    await chrome.alarms.clear(ALARM_MIDNIGHT);
    chrome.alarms.create(ALARM_MIDNIGHT, { when: midnight });
  }

  // -- event handlers --------------------------------------------------------

  /**
   * Re-evaluate what should be counted and move there.
   *
   * Every browser event funnels into this one method. The events themselves
   * carry no meaning - a tab id or window id only tells us that *something*
   * changed, so we ask the browser for the current truth instead of trying to
   * track it incrementally. Chrome can also drop or reorder events around a
   * worker suspension, which incremental state would not survive.
   */
  async reconcile(now: number = Date.now()): Promise<void> {
    await this.enqueue(() => this.reconcileNow(now));
  }

  private async reconcileNow(now: number): Promise<void> {
    const input = await this.readBrowserState();
    const target = resolveTarget(input);
    const { completed } = this.sessions.transitionTo(target, now);

    if (completed) {
      await this.repo.commitInterval(completed.domain, completed.startTime, completed.endTime);
    }
    await this.repo.setTrackerState(this.sessions.current);
  }

  /** Gather everything `resolveTarget` needs, tolerating a hostile browser. */
  private async readBrowserState(): Promise<TrackingInput> {
    const settings = await this.repo.getSettings();
    let activeUrl: string | null = null;
    let windowFocused = false;

    try {
      // `lastFocusedWindow` is the window the user is actually looking at.
      // Querying by `active: true` alone would also match the active tab of
      // every background window.
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) {
        activeUrl = tab.url ?? null;
        const window = await chrome.windows.get(tab.windowId).catch(() => null);
        windowFocused = window?.focused ?? false;
      }
    } catch {
      // A tab or window can disappear between the query and the read. Treat it
      // as "nothing focused" and let the next event correct us.
    }

    return {
      activeUrl,
      windowFocused,
      idleState: this.idleState,
      trackingEnabled: settings.trackingEnabled,
      excludedDomains: settings.excludedDomains,
    };
  }

  /** `chrome.idle.onStateChanged`. */
  async onIdleStateChanged(state: chrome.idle.IdleState, now = Date.now()): Promise<void> {
    const previous = this.idleState;
    this.idleState = state === 'active' ? 'active' : state;

    if (previous === 'active' && state !== 'active') {
      // The event arrives only after the full threshold of inactivity has
      // already elapsed, so "now" is late by exactly that much. Backdating the
      // session end means walking away from a playing video stops the clock at
      // the moment the user actually stopped, not a minute later.
      const settings = await this.repo.getSettings();
      const wentIdleAt = now - settings.idleThresholdSeconds * 1000;
      await this.reconcile(wentIdleAt);
      return;
    }
    await this.reconcile(now);
  }

  /** `chrome.alarms.onAlarm` for the heartbeat. */
  async onHeartbeat(now = Date.now()): Promise<void> {
    await this.enqueue(async () => {
      const state = this.sessions.heartbeat(now);
      if (!state) return; // Nothing open: no work, no storage write.

      // A session that has run past midnight is split now so the day it
      // belongs to is correct even before the user next touches the browser.
      if (toDateKey(state.startedAt) !== toDateKey(now)) {
        const completed = this.sessions.flush(now);
        if (completed) {
          await this.repo.commitInterval(completed.domain, completed.startTime, completed.endTime);
        }
      }
      await this.repo.setTrackerState(this.sessions.current);
    });
  }

  /** `chrome.alarms.onAlarm` for the midnight rollover. */
  async onMidnight(now = Date.now()): Promise<void> {
    await this.enqueue(async () => {
      const completed = this.sessions.flush(now);
      if (completed) {
        await this.repo.commitInterval(completed.domain, completed.startTime, completed.endTime);
      }
      await this.repo.setTrackerState(this.sessions.current);
      await this.repo.prune();
      await this.scheduleMidnightAlarm(now);
    });
  }

  /** Called after any surface writes settings. */
  async onSettingsChanged(now = Date.now()): Promise<void> {
    this.repo.invalidateSettings();
    const settings = await this.repo.getSettings();
    chrome.idle.setDetectionInterval(settings.idleThresholdSeconds);
    await this.reconcile(now);
  }

  /**
   * Commit whatever is open right now. Called before the worker is suspended so
   * the persisted snapshot is as fresh as possible.
   */
  async persistNow(now = Date.now()): Promise<void> {
    await this.enqueue(async () => {
      this.sessions.heartbeat(now);
      await this.repo.setTrackerState(this.sessions.current);
    });
  }

  /** Live view for the popup. Reads in-memory state only - no storage hit. */
  async getLiveStatus(now = Date.now()): Promise<LiveStatus> {
    const settings = await this.repo.getSettings();
    const open: PersistedTrackerState | null = this.sessions.current;
    return {
      trackingEnabled: settings.trackingEnabled,
      current: open
        ? { domain: open.domain, startedAt: open.startedAt, elapsed: Math.max(0, now - open.startedAt) }
        : null,
      reason: this.sessions.idleReason,
    };
  }
}

/**
 * `chrome.idle.queryState` needs a threshold and can reject if the API is
 * unavailable; assume the user is present rather than silently stopping.
 */
async function queryIdleState(thresholdSeconds: number): Promise<'active' | 'idle' | 'locked'> {
  try {
    return await chrome.idle.queryState(thresholdSeconds);
  } catch {
    return 'active';
  }
}
