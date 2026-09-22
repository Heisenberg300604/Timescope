/**
 * Core domain types for TimeScope.
 *
 * Design note: every persisted shape is versioned via `StoredMeta.schemaVersion`
 * so that `storage/migrations.ts` can evolve records without data loss.
 */

/** Identifier for a category. Stable across renames so user edits are safe. */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Index into the restrained category palette (see `categories/palette.ts`). */
  colorIndex: number;
  /** True for the built-in fallback bucket, which cannot be deleted. */
  isFallback?: boolean;
}

/**
 * A single continuous stretch of attention on one domain.
 * Sessions never span a calendar day: `time-calculator` splits them at midnight.
 */
export interface Session {
  domain: string;
  /** Epoch ms, inclusive. */
  startTime: number;
  /** Epoch ms, exclusive. */
  endTime: number;
  /** Always `endTime - startTime`; stored to keep aggregation cheap. */
  duration: number;
}

/**
 * All tracking data for one local calendar day, stored under key `day:YYYY-MM-DD`.
 * One key per day keeps the common read ("show me today") to a single storage hit.
 */
export interface DayRecord {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** domain -> total active milliseconds that day. */
  totals: Record<string, number>;
  /** 24 buckets of active milliseconds, indexed by local hour. */
  hourly: number[];
  /** Raw sessions, newest last. Pruned by retention policy. */
  sessions: Session[];
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Master switch. When false the tracker parks in IDLE and records nothing. */
  trackingEnabled: boolean;
  /**
   * Seconds of OS-level inactivity before time stops counting.
   * Chrome enforces a 15s floor on `chrome.idle.setDetectionInterval`.
   */
  idleThresholdSeconds: number;
  /** Domain patterns that are never tracked. See `utils/exclusions.ts`. */
  excludedDomains: string[];
  /** User-editable domain -> category assignments, layered over the defaults. */
  domainCategories: Record<string, CategoryId>;
  /** Full category list, seeded from defaults and editable by the user. */
  categories: Category[];
  theme: ThemePreference;
  /** Days of raw session detail to keep. Daily totals are kept longer. */
  sessionRetentionDays: number;
  /** Days of aggregate day records to keep. */
  dayRetentionDays: number;
}

export interface StoredMeta {
  schemaVersion: number;
  installedAt: number;
  /** Last date pruning ran, so it runs at most once per day. */
  lastPruneDate?: string;
}

/** The tracker's finite states. See `tracking/session-manager.ts`. */
export type TrackerStateName = 'idle' | 'active';

/**
 * Snapshot of the in-flight session, persisted so a suspended or crashed
 * service worker can recover without losing or double-counting time.
 */
export interface PersistedTrackerState {
  domain: string;
  startedAt: number;
  /**
   * Last moment we positively confirmed the session was still active.
   * On crash recovery the session is committed up to this point, which bounds
   * over-counting to one heartbeat interval.
   */
  lastHeartbeatAt: number;
}

/** Live tracker view returned to the popup over `chrome.runtime.sendMessage`. */
export interface LiveStatus {
  trackingEnabled: boolean;
  /** Null when parked in IDLE. */
  current: { domain: string; startedAt: number; elapsed: number } | null;
  reason: IdleReason | null;
}

/** Why the tracker is not currently counting. Drives popup copy. */
export type IdleReason =
  | 'paused'
  | 'user-idle'
  | 'window-unfocused'
  | 'excluded'
  | 'untrackable';

/** Aggregate shape consumed by every dashboard chart and list. */
export interface RangeStats {
  /** Local dates included, ascending. */
  dates: string[];
  totalMs: number;
  /** domain -> ms, descending by ms. */
  domains: DomainTotal[];
  /** categoryId -> ms, descending by ms. */
  categories: CategoryTotal[];
  /** 24 hourly buckets, summed across the range. */
  hourly: number[];
  /** Per-day totals, ascending by date. Used by the weekly trend chart. */
  daily: { date: string; totalMs: number }[];
}

export interface DomainTotal {
  domain: string;
  ms: number;
  categoryId: CategoryId;
}

export interface CategoryTotal {
  categoryId: CategoryId;
  label: string;
  colorIndex: number;
  ms: number;
}

/** Messages exchanged between UI surfaces and the background service worker. */
export type RuntimeRequest =
  | { type: 'get-live-status' }
  | { type: 'settings-changed' }
  | { type: 'flush' };

export type RuntimeResponse = LiveStatus | { ok: true } | { ok: false; error: string };
