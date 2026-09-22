/**
 * Local-time date helpers.
 *
 * Everything is persisted as epoch milliseconds and interpreted in the user's
 * LOCAL timezone. We never format or bucket in UTC: a day must begin at the
 * user's midnight, not at 00:00Z.
 *
 * All day arithmetic goes through `Date` component mutation rather than adding
 * 86_400_000 ms, so days that are 23 or 25 hours long (DST transitions) still
 * map to exactly one date key.
 */

/** `YYYY-MM-DD` in local time. This is the storage key suffix for a day. */
export type DateKey = string;

export function toDateKey(timestamp: number | Date): DateKey {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Epoch ms of local midnight that begins `key`'s day. */
export function startOfDay(key: DateKey): number {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

/**
 * Epoch ms of the next local midnight after `timestamp`.
 * Uses component arithmetic so it lands on 00:00 local even across DST.
 */
export function nextMidnight(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

/** Shift a date key by whole days. Negative `days` moves backwards. */
export function addDays(key: DateKey, days: number): DateKey {
  const [year, month, day] = key.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

/** Whole days from `from` to `to`, computed on calendar dates (DST-safe). */
export function daysBetween(from: DateKey, to: DateKey): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  // Compare as UTC midnights: both sides lose the same offset, so the
  // difference is an exact whole number of days.
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive ascending list of date keys, oldest first. */
export function dateRange(startKey: DateKey, endKey: DateKey): DateKey[] {
  const span = daysBetween(startKey, endKey);
  if (span < 0) return [];
  const keys: DateKey[] = [];
  for (let i = 0; i <= span; i += 1) keys.push(addDays(startKey, i));
  return keys;
}

/** The last `count` days ending today (inclusive), oldest first. */
export function lastNDays(count: number, today: DateKey): DateKey[] {
  return dateRange(addDays(today, -(count - 1)), today);
}
