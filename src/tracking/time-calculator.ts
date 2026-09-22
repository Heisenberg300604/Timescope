/**
 * Pure interval mathematics: turning one `[start, end)` stretch of attention
 * into per-day and per-hour contributions.
 *
 * This module has no browser dependencies so it can be exhaustively tested.
 */

import { nextMidnight, toDateKey, type DateKey } from '../utils/date';
import type { Session } from '../types';

/** The smallest stretch worth recording. Below this it is switching noise. */
export const MIN_SESSION_MS = 1000;

/** A session confined to a single local calendar day. */
export interface DaySlice {
  date: DateKey;
  session: Session;
}

/**
 * Split `[startTime, endTime)` at local midnights so no session ever straddles
 * two calendar days. A session from 23:58 to 00:07 becomes two slices, which is
 * what daily totals require.
 *
 * Returns `[]` for inverted, zero-length or non-finite intervals - defensive
 * because timestamps ultimately come from browser events that can arrive out of
 * order after a clock change or a suspended worker.
 */
export function splitAcrossDays(domain: string, startTime: number, endTime: number): DaySlice[] {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return [];
  if (endTime <= startTime) return [];

  const slices: DaySlice[] = [];
  let cursor = startTime;

  // Guard against an unbounded loop if a bad clock produces an absurd interval.
  const maxSlices = 400;
  while (cursor < endTime && slices.length < maxSlices) {
    const boundary = Math.min(nextMidnight(cursor), endTime);
    const duration = boundary - cursor;
    if (duration >= MIN_SESSION_MS) {
      slices.push({
        date: toDateKey(cursor),
        session: { domain, startTime: cursor, endTime: boundary, duration },
      });
    }
    cursor = boundary;
  }

  return slices;
}

/**
 * Distribute a single-day session across 24 local hour buckets by real overlap,
 * so a 09:50-10:30 session contributes 10 minutes to hour 9 and 30 to hour 10
 * rather than landing entirely in one bucket.
 *
 * @param buckets a 24-length array that is mutated in place.
 */
export function addToHourlyBuckets(buckets: number[], session: Session): void {
  let cursor = session.startTime;
  while (cursor < session.endTime) {
    const boundary = nextHourBoundary(cursor);
    // A non-advancing boundary would spin forever; only reachable via a
    // pathological clock, but the tracker must never hang the worker.
    if (boundary <= cursor) break;

    const sliceEnd = Math.min(boundary, session.endTime);
    // Read the hour from the wall clock so a DST shift inside the session
    // cannot smear time into the wrong bucket.
    const hour = new Date(cursor).getHours();
    buckets[hour] = (buckets[hour] ?? 0) + (sliceEnd - cursor);
    cursor = sliceEnd;
  }
}

/** Epoch ms of the next local top-of-hour strictly after `timestamp`. */
function nextHourBoundary(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1, 0, 0, 0,
  ).getTime();
}

/** A fresh, correctly sized hourly bucket array. */
export function emptyHourly(): number[] {
  return new Array(24).fill(0);
}
