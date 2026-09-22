/**
 * The tracking state machine.
 *
 * There are exactly two states:
 *
 *   IDLE            nothing is being counted
 *   ACTIVE(domain)  one open session on exactly one domain
 *
 * Every browser event (tab activated, tab updated, window focus changed, idle
 * state changed, settings changed, worker restarted) is reduced to the same
 * question - "what, if anything, should be counted right now?" - answered by
 * `resolveTarget`. The manager then moves to that target. There are no
 * per-event branches and no scattered booleans, so every transition is
 * deterministic and the same in every code path.
 *
 * Two invariants make double counting structurally impossible:
 *
 *   1. At most ONE session is open at any time. Two tabs on youtube.com resolve
 *      to the same target, so switching between them is a no-op, not a restart.
 *   2. A transition to the SAME domain never closes and reopens the session,
 *      so rapid tab switching cannot fragment or duplicate time.
 *
 * This module is deliberately free of `chrome.*` so it can be tested directly.
 */

import type { IdleReason, PersistedTrackerState } from '../types';
import { normalizeUrl } from './domain-normalizer';
import { isExcluded } from '../utils/exclusions';
import { MIN_SESSION_MS } from './time-calculator';

/** Everything needed to decide what should be counted. */
export interface TrackingInput {
  /** URL of the active tab in the focused window; null if there is none. */
  activeUrl: string | null;
  /** False when no browser window holds OS focus (minimized, other app). */
  windowFocused: boolean;
  /** OS idle state from `chrome.idle`. */
  idleState: 'active' | 'idle' | 'locked';
  /** Master tracking switch from settings. */
  trackingEnabled: boolean;
  excludedDomains: string[];
}

export interface Target {
  domain: string | null;
  /** Why nothing is being counted. Null when `domain` is set. */
  reason: IdleReason | null;
}

/**
 * The single decision function. Order matters: the most specific explanation
 * of "why not" wins, because the popup shows this reason to the user.
 */
export function resolveTarget(input: TrackingInput): Target {
  if (!input.trackingEnabled) return { domain: null, reason: 'paused' };
  if (input.idleState !== 'active') return { domain: null, reason: 'user-idle' };
  if (!input.windowFocused) return { domain: null, reason: 'window-unfocused' };

  const domain = normalizeUrl(input.activeUrl);
  if (!domain) return { domain: null, reason: 'untrackable' };
  if (isExcluded(domain, input.excludedDomains)) return { domain: null, reason: 'excluded' };

  return { domain, reason: null };
}

/** A completed stretch of attention, handed to the repository to persist. */
export interface CompletedInterval {
  domain: string;
  startTime: number;
  endTime: number;
}

export interface TransitionResult {
  /** Non-null when the previous session ended and should be written. */
  completed: CompletedInterval | null;
  /** True when the open session changed (started, ended or switched domain). */
  changed: boolean;
}

/**
 * Holds the single open session and produces completed intervals.
 *
 * The manager never touches storage or the clock itself: timestamps are passed
 * in. That makes every scenario in the test suite - midnight, rapid switching,
 * worker restart - expressible without mocking time.
 */
export class SessionManager {
  private open: PersistedTrackerState | null = null;
  private reason: IdleReason | null = 'untrackable';

  /** Restore an in-flight session after a service-worker restart. */
  adopt(state: PersistedTrackerState | null): void {
    this.open = state;
    if (state) this.reason = null;
  }

  get current(): PersistedTrackerState | null {
    return this.open;
  }

  get idleReason(): IdleReason | null {
    return this.open ? null : this.reason;
  }

  /**
   * Move to `target` as of `now`.
   *
   * Switching to the domain already open is a no-op beyond refreshing the
   * heartbeat, which is what keeps two tabs on the same site from splitting
   * into two sessions.
   */
  transitionTo(target: Target, now: number): TransitionResult {
    this.reason = target.reason;

    if (this.open && this.open.domain === target.domain) {
      this.open.lastHeartbeatAt = now;
      return { completed: null, changed: false };
    }

    const completed = this.closeOpen(now);

    if (target.domain) {
      this.open = { domain: target.domain, startedAt: now, lastHeartbeatAt: now };
      return { completed, changed: true };
    }

    this.open = null;
    return { completed, changed: completed !== null };
  }

  /**
   * Confirm the open session is still live as of `now`.
   *
   * Called on the heartbeat alarm. The stored `lastHeartbeatAt` is the
   * high-water mark that crash recovery commits up to, which bounds any
   * over-count after an unclean shutdown to one heartbeat interval.
   */
  heartbeat(now: number): PersistedTrackerState | null {
    if (this.open) this.open.lastHeartbeatAt = now;
    return this.open;
  }

  /**
   * End the open session at `now` without starting another.
   * Used at midnight rollover and before the worker shuts down.
   */
  flush(now: number): CompletedInterval | null {
    const completed = this.closeOpen(now);
    if (completed) {
      // Immediately reopen on the same domain so an intentional flush does not
      // silently stop tracking a site the user is still looking at.
      this.open = { domain: completed.domain, startedAt: now, lastHeartbeatAt: now };
    }
    return completed;
  }

  /**
   * Close the open session, discarding stretches too short to be meaningful.
   *
   * A negative or zero span can happen if the system clock moves backwards;
   * dropping it is correct and keeps negative durations out of storage.
   */
  private closeOpen(now: number): CompletedInterval | null {
    const open = this.open;
    this.open = null;
    if (!open) return null;

    const endTime = Math.max(open.startedAt, now);
    if (endTime - open.startedAt < MIN_SESSION_MS) return null;

    return { domain: open.domain, startTime: open.startedAt, endTime };
  }
}
