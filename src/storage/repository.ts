/**
 * The only module that reads or writes tracking data.
 *
 * UI code calls these methods; it never touches `chrome.storage` itself. That
 * gives one place to validate shapes, cache hot reads, and apply retention.
 */

import type {
  CategoryTotal,
  DayRecord,
  DomainTotal,
  RangeStats,
  Session,
  Settings,
  StoredMeta,
  PersistedTrackerState,
} from '../types';
import { chromeStorageArea, type StorageArea } from './area';
import {
  DEFAULT_SETTINGS,
  KEYS,
  SCHEMA_VERSION,
  defaultMeta,
  emptyDayRecord,
  parseDayRecord,
  parseSettings,
} from './schema';
import { runMigrations } from './migrations';
import { addToHourlyBuckets, emptyHourly, splitAcrossDays } from '../tracking/time-calculator';
import { addDays, daysBetween, toDateKey, type DateKey } from '../utils/date';
import { createCategoryLookup } from '../categories/resolver';

export class TrackingRepository {
  private readonly area: StorageArea;

  /**
   * Settings are read on nearly every operation, so they are cached and
   * invalidated on write and on external change. Day records are NOT cached
   * here: the background worker may append to them at any time, and a stale
   * dashboard number is worse than an extra storage read.
   */
  private settingsCache: Settings | null = null;

  constructor(area: StorageArea = chromeStorageArea) {
    this.area = area;
  }

  // -- lifecycle -------------------------------------------------------------

  /** Ensure metadata exists and run any pending schema migrations. */
  async initialize(now: number = Date.now()): Promise<void> {
    const stored = await this.area.get([KEYS.meta]);
    const meta = stored[KEYS.meta] as StoredMeta | undefined;

    if (!meta) {
      await this.area.set({ [KEYS.meta]: defaultMeta(now) });
      return;
    }
    if (meta.schemaVersion !== SCHEMA_VERSION) {
      await runMigrations(this.area, meta.schemaVersion);
      await this.area.set({
        [KEYS.meta]: { ...meta, schemaVersion: SCHEMA_VERSION },
      });
    }
  }

  async getMeta(): Promise<StoredMeta> {
    const stored = await this.area.get([KEYS.meta]);
    return (stored[KEYS.meta] as StoredMeta | undefined) ?? defaultMeta(Date.now());
  }

  // -- settings --------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    if (this.settingsCache) return this.settingsCache;
    const stored = await this.area.get([KEYS.settings]);
    this.settingsCache = parseSettings(stored[KEYS.settings]);
    return this.settingsCache;
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next = parseSettings({ ...current, ...patch });
    await this.area.set({ [KEYS.settings]: next });
    this.settingsCache = next;
    return next;
  }

  /** Drop the settings cache after an external write (another surface saved). */
  invalidateSettings(): void {
    this.settingsCache = null;
  }

  // -- tracker state ---------------------------------------------------------

  async getTrackerState(): Promise<PersistedTrackerState | null> {
    const stored = await this.area.get([KEYS.trackerState]);
    const state = stored[KEYS.trackerState] as PersistedTrackerState | undefined;
    if (
      !state ||
      typeof state.domain !== 'string' ||
      typeof state.startedAt !== 'number' ||
      typeof state.lastHeartbeatAt !== 'number'
    ) {
      return null;
    }
    return state;
  }

  async setTrackerState(state: PersistedTrackerState | null): Promise<void> {
    if (state === null) await this.area.remove([KEYS.trackerState]);
    else await this.area.set({ [KEYS.trackerState]: state });
  }

  // -- day records -----------------------------------------------------------

  async getDay(date: DateKey): Promise<DayRecord> {
    const key = KEYS.day(date);
    const stored = await this.area.get([key]);
    return parseDayRecord(stored[key], date);
  }

  async getDays(dates: DateKey[]): Promise<DayRecord[]> {
    if (dates.length === 0) return [];
    const keys = dates.map(KEYS.day);
    const stored = await this.area.get(keys);
    return dates.map((date) => parseDayRecord(stored[KEYS.day(date)], date));
  }

  /**
   * Persist one completed stretch of attention.
   *
   * The interval is split at local midnight first, so a session running from
   * 23:58 to 00:07 lands correctly in both days' totals, hourly buckets and
   * session lists. Writes touch only the affected day keys.
   */
  async commitInterval(domain: string, startTime: number, endTime: number): Promise<void> {
    const slices = splitAcrossDays(domain, startTime, endTime);
    if (slices.length === 0) return;

    // Group by date so a midnight-spanning session is still two writes, not more.
    const byDate = new Map<DateKey, Session[]>();
    for (const { date, session } of slices) {
      const list = byDate.get(date);
      if (list) list.push(session);
      else byDate.set(date, [session]);
    }

    const dates = [...byDate.keys()];
    const records = await this.getDays(dates);
    const updates: Record<string, DayRecord> = {};

    records.forEach((record, index) => {
      const date = dates[index];
      for (const session of byDate.get(date) ?? []) {
        record.totals[session.domain] = (record.totals[session.domain] ?? 0) + session.duration;
        addToHourlyBuckets(record.hourly, session);
        record.sessions.push(session);
      }
      updates[KEYS.day(date)] = record;
    });

    await this.area.set(updates);
  }

  // -- analytics -------------------------------------------------------------

  /**
   * Aggregate a contiguous date range into the single shape every dashboard
   * view consumes. One storage read for the whole range.
   */
  async getRangeStats(startDate: DateKey, endDate: DateKey): Promise<RangeStats> {
    const span = daysBetween(startDate, endDate);
    const dates: DateKey[] = [];
    for (let i = 0; i <= span; i += 1) dates.push(addDays(startDate, i));

    const [records, settings] = await Promise.all([this.getDays(dates), this.getSettings()]);
    return aggregate(records, settings);
  }

  /** Every session recorded on one day, newest first. */
  async getSessions(date: DateKey): Promise<Session[]> {
    const record = await this.getDay(date);
    return [...record.sessions].sort((a, b) => b.startTime - a.startTime);
  }

  // -- data management -------------------------------------------------------

  /**
   * Remove all recorded activity. Settings are preserved by default so a user
   * clearing history does not also lose their exclusions and categories.
   */
  async clearTrackingData(): Promise<void> {
    const all = await this.area.get(null);
    const dayKeys = Object.keys(all).filter((k) => k.startsWith(KEYS.dayPrefix));
    await this.area.remove([...dayKeys, KEYS.trackerState]);
  }

  /** Remove everything, including settings, returning the extension to install state. */
  async clearEverything(): Promise<void> {
    await this.area.clear();
    this.settingsCache = null;
    await this.initialize();
  }

  /**
   * Apply retention: drop raw session detail beyond `sessionRetentionDays`
   * while keeping that day's totals, and drop whole days beyond
   * `dayRetentionDays`. Runs at most once per local day.
   */
  async prune(today: DateKey = toDateKey(Date.now())): Promise<{ pruned: number }> {
    const [settings, meta, all] = await Promise.all([
      this.getSettings(),
      this.getMeta(),
      this.area.get(null),
    ]);
    if (meta.lastPruneDate === today) return { pruned: 0 };

    const dayKeys = Object.keys(all).filter((k) => k.startsWith(KEYS.dayPrefix));
    const toRemove: string[] = [];
    const toUpdate: Record<string, DayRecord> = {};

    for (const key of dayKeys) {
      const date = key.slice(KEYS.dayPrefix.length);
      const age = daysBetween(date, today);
      if (age < 0) continue; // A future-dated record: leave it alone.

      if (age > settings.dayRetentionDays) {
        toRemove.push(key);
      } else if (age > settings.sessionRetentionDays) {
        const record = parseDayRecord(all[key], date);
        // Totals and hourly buckets survive; only the bulky raw list is dropped.
        if (record.sessions.length > 0) toUpdate[key] = { ...record, sessions: [] };
      }
    }

    if (toRemove.length) await this.area.remove(toRemove);
    if (Object.keys(toUpdate).length) await this.area.set(toUpdate);
    await this.area.set({ [KEYS.meta]: { ...meta, lastPruneDate: today } });

    return { pruned: toRemove.length + Object.keys(toUpdate).length };
  }

  /**
   * Everything the user has stored, as a plain object ready to serialize.
   * Contains only domains, categories, timestamps and durations - the same
   * minimal fields the extension records.
   */
  async exportAll(): Promise<ExportBundle> {
    const [all, settings, meta] = await Promise.all([
      this.area.get(null),
      this.getSettings(),
      this.getMeta(),
    ]);
    const days = Object.keys(all)
      .filter((k) => k.startsWith(KEYS.dayPrefix))
      .sort()
      .map((k) => parseDayRecord(all[k], k.slice(KEYS.dayPrefix.length)));

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      installedAt: new Date(meta.installedAt).toISOString(),
      settings,
      days,
    };
  }

  async storageBytesInUse(): Promise<number | null> {
    try {
      return await chrome.storage.local.getBytesInUse(null);
    } catch {
      return null;
    }
  }
}

export interface ExportBundle {
  exportedAt: string;
  schemaVersion: number;
  installedAt: string;
  settings: Settings;
  days: DayRecord[];
}

/**
 * Fold day records into the shared analytics shape.
 * Exported for direct unit testing without a storage round-trip.
 */
export function aggregate(records: DayRecord[], settings: Settings = DEFAULT_SETTINGS): RangeStats {
  const categoryOf = createCategoryLookup(settings);

  const domainMs = new Map<string, number>();
  const hourly = emptyHourly();
  const daily: { date: DateKey; totalMs: number }[] = [];
  let totalMs = 0;

  for (const record of records) {
    let dayTotal = 0;
    for (const [domain, ms] of Object.entries(record.totals)) {
      domainMs.set(domain, (domainMs.get(domain) ?? 0) + ms);
      dayTotal += ms;
    }
    for (let h = 0; h < 24; h += 1) hourly[h] += record.hourly[h] ?? 0;
    daily.push({ date: record.date, totalMs: dayTotal });
    totalMs += dayTotal;
  }

  const domains: DomainTotal[] = [...domainMs.entries()]
    .map(([domain, ms]) => ({ domain, ms, categoryId: categoryOf(domain).id }))
    .sort((a, b) => b.ms - a.ms);

  const categoryMs = new Map<string, number>();
  for (const d of domains) categoryMs.set(d.categoryId, (categoryMs.get(d.categoryId) ?? 0) + d.ms);

  const categories: CategoryTotal[] = [...categoryMs.entries()]
    .map(([categoryId, ms]) => {
      const category = categoryOf(domains.find((d) => d.categoryId === categoryId)!.domain);
      return { categoryId, label: category.label, colorIndex: category.colorIndex, ms };
    })
    .sort((a, b) => b.ms - a.ms);

  return { dates: records.map((r) => r.date), totalMs, domains, categories, hourly, daily };
}

/** Shared singleton for UI surfaces. The worker builds its own instance. */
export const repository = new TrackingRepository();

export { emptyDayRecord };
