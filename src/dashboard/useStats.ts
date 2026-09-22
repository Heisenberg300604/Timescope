/**
 * Data access for the dashboard.
 *
 * Every view reads through these hooks, which wrap the repository and add the
 * three states a real UI needs: loading, error, and loaded. Storage changes
 * from the background worker trigger a refetch, so an open dashboard stays
 * live without polling.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RangeStats, Session, Settings } from '../types';
import { repository } from '../storage/repository';
import { KEYS } from '../storage/schema';
import { lastNDays, toDateKey, type DateKey } from '../utils/date';

export type RangeId = 'today' | 'yesterday' | 'week';

export interface Range {
  id: RangeId;
  label: string;
  start: DateKey;
  end: DateKey;
}

/** Resolve a range id against today's date, in the user's local timezone. */
export function resolveRange(id: RangeId, today: DateKey): Range {
  const days = lastNDays(7, today);
  switch (id) {
    case 'yesterday': {
      const yesterday = lastNDays(2, today)[0];
      return { id, label: 'Yesterday', start: yesterday, end: yesterday };
    }
    case 'week':
      return { id, label: 'Last 7 days', start: days[0], end: days[6] };
    case 'today':
    default:
      return { id: 'today', label: 'Today', start: today, end: today };
  }
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Run an async read, refetching whenever the background worker writes.
 *
 * The listener is scoped to day records and settings, so an unrelated write
 * (the tracker's heartbeat snapshot, for instance) does not re-render the
 * whole dashboard every minute.
 */
function useRepositoryRead<T>(read: () => Promise<T>, deps: unknown[]): AsyncState<T> & {
  refresh: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const readRef = useRef(read);
  readRef.current = read;

  const load = useCallback(async () => {
    try {
      const data = await readRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      console.error('[TimeScope] failed to read statistics', error);
      setState({ data: null, loading: false, error: error as Error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local') return;
      const relevant = Object.keys(changes).some(
        (key) => key.startsWith(KEYS.dayPrefix) || key === KEYS.settings,
      );
      if (relevant) {
        repository.invalidateSettings();
        void load();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [load]);

  return { ...state, refresh: () => void load() };
}

/** Today's date key, refreshed if the dashboard is left open past midnight. */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => toDateKey(Date.now()));

  useEffect(() => {
    // Checking once a minute is enough to notice a day boundary and costs
    // nothing; the alternative is a stale "Today" on a dashboard left open.
    const timer = window.setInterval(() => {
      const current = toDateKey(Date.now());
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return today;
}

export function useRangeStats(range: Range) {
  return useRepositoryRead<RangeStats>(
    () => repository.getRangeStats(range.start, range.end),
    [range.start, range.end],
  );
}

export function useSessions(date: DateKey) {
  return useRepositoryRead<Session[]>(() => repository.getSessions(date), [date]);
}

export function useSettings() {
  const state = useRepositoryRead<Settings>(() => repository.getSettings(), []);

  const save = useCallback(async (patch: Partial<Settings>) => {
    await repository.saveSettings(patch);
    // The storage listener above picks the change up and refetches.
  }, []);

  return { ...state, save };
}

/** Per-day totals for one domain across a range, for the detail page. */
export function useDomainHistory(domain: string, today: DateKey, days = 7) {
  return useRepositoryRead(async () => {
    const dates = lastNDays(days, today);
    const records = await repository.getDays(dates);
    return records.map((record) => ({
      date: record.date,
      ms: record.totals[domain] ?? 0,
    }));
  }, [domain, today, days]);
}
