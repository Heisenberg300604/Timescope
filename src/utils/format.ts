/**
 * Human-readable formatting. Kept free of React so the background worker and
 * tests can use it too.
 */

import { toDateKey, type DateKey } from './date';

/**
 * Durations in the analytics idiom used throughout the UI: `2h 14m`, `51m`,
 * `–` for nothing. Sub-minute values show seconds so a fresh session is
 * visibly ticking rather than sitting at `0m`.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** Long form used for single metrics, e.g. `33m 30s` for an average session. */
export function formatDurationPrecise(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && !hours) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

/** `14:31` or `2:31 PM`, following the browser locale. */
export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** `Mon`, for compact axis labels. */
export function formatWeekdayShort(key: DateKey): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

/** `Monday`, for the weekly breakdown list. */
export function formatWeekdayLong(key: DateKey): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}

/** `Today` / `Yesterday` / `Mon, 22 Sep` depending on recency. */
export function formatDateLabel(key: DateKey, today: DateKey = toDateKey(Date.now())): string {
  if (key === today) return 'Today';
  const date = new Date(`${key}T00:00:00`);
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateKey(date) === toDateKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Percentage rendered without a misleading `0%` for tiny-but-present values. */
export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const pct = (part / whole) * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/** Time-of-day greeting for the dashboard header. Calm, never motivational. */
export function greeting(now: number = Date.now()): string {
  const hour = new Date(now).getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
