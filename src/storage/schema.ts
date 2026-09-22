/**
 * Storage keys, defaults and validation.
 *
 * Layout in `chrome.storage.local`:
 *
 *   meta            StoredMeta        schema version + install timestamp
 *   settings        Settings          user preferences
 *   tracker:state   PersistedTrackerState | null   in-flight session snapshot
 *   day:YYYY-MM-DD  DayRecord         one key per local calendar day
 *
 * One key per day means the common read - "show me today" - is a single hit,
 * and a week is seven parallel hits, while keeping each written value small.
 * Sessions live inside their day record so a day is always internally
 * consistent: totals, hourly buckets and sessions are written atomically.
 */

import type { DayRecord, Session, Settings, StoredMeta } from '../types';
import { DEFAULT_CATEGORIES } from '../categories/catalog';
import { emptyHourly } from '../tracking/time-calculator';

export const SCHEMA_VERSION = 1;

export const KEYS = {
  meta: 'meta',
  settings: 'settings',
  trackerState: 'tracker:state',
  /** Key for one day's record. */
  day: (date: string) => `day:${date}`,
  dayPrefix: 'day:',
} as const;

/**
 * Chrome enforces a 15-second floor on `chrome.idle.setDetectionInterval`.
 * 60 seconds is the V1 default: long enough that reading a long article or
 * watching a video without touching the mouse is not misread as absence,
 * short enough that stepping away from the desk stops the clock promptly.
 */
export const DEFAULT_IDLE_THRESHOLD_SECONDS = 60;
export const MIN_IDLE_THRESHOLD_SECONDS = 15;
export const MAX_IDLE_THRESHOLD_SECONDS = 15 * 60;

export const DEFAULT_SETTINGS: Settings = {
  trackingEnabled: true,
  idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
  excludedDomains: [],
  domainCategories: {},
  categories: DEFAULT_CATEGORIES,
  theme: 'system',
  // Raw sessions are the bulky part; 30 days covers every V1 view with room
  // to spare. Daily aggregates are small and kept far longer for trends.
  sessionRetentionDays: 30,
  dayRetentionDays: 365,
};

export function emptyDayRecord(date: string): DayRecord {
  return { date, totals: {}, hourly: emptyHourly(), sessions: [] };
}

/**
 * Coerce an unknown stored value into a valid `DayRecord`.
 *
 * Storage can be corrupted by a crash mid-write, by a downgrade, or by another
 * version of the extension. Every read passes through here so the UI is never
 * handed a shape it does not expect - a bad record degrades to an empty day
 * rather than throwing somewhere deep in a chart.
 */
export function parseDayRecord(value: unknown, date: string): DayRecord {
  if (!value || typeof value !== 'object') return emptyDayRecord(date);
  const raw = value as Partial<DayRecord>;

  const totals: Record<string, number> = {};
  if (raw.totals && typeof raw.totals === 'object') {
    for (const [domain, ms] of Object.entries(raw.totals)) {
      if (typeof domain === 'string' && domain && isPositiveFinite(ms)) {
        totals[domain] = ms;
      }
    }
  }

  const hourly = emptyHourly();
  if (Array.isArray(raw.hourly)) {
    for (let i = 0; i < 24; i += 1) {
      const v = raw.hourly[i];
      hourly[i] = isPositiveFinite(v) ? v : 0;
    }
  }

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(isValidSession)
    : [];

  return { date: typeof raw.date === 'string' ? raw.date : date, totals, hourly, sessions };
}

function isPositiveFinite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isValidSession(v: unknown): v is Session {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<Session>;
  return (
    typeof s.domain === 'string' &&
    s.domain.length > 0 &&
    isPositiveFinite(s.startTime) &&
    isPositiveFinite(s.endTime) &&
    isPositiveFinite(s.duration) &&
    s.endTime > s.startTime
  );
}

/**
 * Coerce an unknown stored value into valid `Settings`, filling any missing
 * field from the defaults. This doubles as forward compatibility: a record
 * written by a newer version keeps the fields this version understands.
 */
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const raw = value as Partial<Settings>;

  return {
    trackingEnabled:
      typeof raw.trackingEnabled === 'boolean'
        ? raw.trackingEnabled
        : DEFAULT_SETTINGS.trackingEnabled,
    idleThresholdSeconds: clampIdleThreshold(raw.idleThresholdSeconds),
    excludedDomains: Array.isArray(raw.excludedDomains)
      ? raw.excludedDomains.filter((d): d is string => typeof d === 'string' && d.length > 0)
      : [],
    domainCategories: isStringRecord(raw.domainCategories) ? raw.domainCategories : {},
    categories: parseCategories(raw.categories),
    theme:
      raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
        ? raw.theme
        : DEFAULT_SETTINGS.theme,
    sessionRetentionDays: clampDays(raw.sessionRetentionDays, DEFAULT_SETTINGS.sessionRetentionDays),
    dayRetentionDays: clampDays(raw.dayRetentionDays, DEFAULT_SETTINGS.dayRetentionDays),
  };
}

function clampIdleThreshold(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_IDLE_THRESHOLD_SECONDS;
  return Math.min(MAX_IDLE_THRESHOLD_SECONDS, Math.max(MIN_IDLE_THRESHOLD_SECONDS, Math.round(v)));
}

function clampDays(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) return fallback;
  return Math.min(3650, Math.round(v));
}

function isStringRecord(v: unknown): v is Record<string, string> {
  return (
    v !== null &&
    typeof v === 'object' &&
    Object.values(v as object).every((x) => typeof x === 'string')
  );
}

/**
 * Validate the category list, always guaranteeing a fallback category exists
 * so `findCategory` can never come up empty.
 */
function parseCategories(value: unknown): import('../types').Category[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_CATEGORIES;
  const parsed = value.filter(
    (c): c is import('../types').Category =>
      c !== null &&
      typeof c === 'object' &&
      typeof (c as { id?: unknown }).id === 'string' &&
      typeof (c as { label?: unknown }).label === 'string' &&
      typeof (c as { colorIndex?: unknown }).colorIndex === 'number',
  );
  if (parsed.length === 0) return DEFAULT_CATEGORIES;
  if (!parsed.some((c) => c.isFallback)) {
    const fallback = DEFAULT_CATEGORIES.find((c) => c.isFallback);
    if (fallback) parsed.push(fallback);
  }
  return parsed;
}

export function defaultMeta(now: number): StoredMeta {
  return { schemaVersion: SCHEMA_VERSION, installedAt: now };
}
