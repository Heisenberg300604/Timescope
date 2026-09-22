/**
 * The popup: three facts and a way in.
 *
 * Today's total, what is being tracked right now, and the top few sites. It
 * deliberately does not reproduce the dashboard - the popup's job is a glance,
 * and every extra panel costs open-time.
 *
 * It reads today's record straight from storage (one key) and asks the worker
 * only for the live session, so it renders without waiting on the worker to
 * wake up.
 */
import { useEffect, useState } from 'react';
import type { LiveStatus, RangeStats, Settings } from '../types';
import { repository } from '../storage/repository';
import { toDateKey } from '../utils/date';
import { formatDuration } from '../utils/format';
import { domainLabel } from '../categories/resolver';
import { Favicon } from '../shared/ui/Favicon';
import { BRANDING } from '../shared/branding';
import { applyTheme } from '../shared/theme';

const IDLE_COPY: Record<NonNullable<LiveStatus['reason']>, string> = {
  paused: 'Tracking paused',
  'user-idle': 'Away from the computer',
  'window-unfocused': 'Browser not in focus',
  excluded: 'This site is excluded',
  untrackable: 'Nothing to track',
};

export function Popup() {
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);

  useEffect(() => {
    const today = toDateKey(Date.now());
    void Promise.all([repository.getRangeStats(today, today), repository.getSettings()])
      .then(([rangeStats, loadedSettings]) => {
        setStats(rangeStats);
        setSettings(loadedSettings);
        applyTheme(loadedSettings.theme);
      })
      .catch((error) => console.error('[TimeScope] popup failed to load', error));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      chrome.runtime.sendMessage({ type: 'get-live-status' }, (response?: LiveStatus) => {
        // A missing response means the worker is starting; the next tick retries.
        if (chrome.runtime.lastError || cancelled || !response) return;
        setLive(response);
      });
    };

    poll();
    // The popup is open for seconds at a time. A one-second tick here keeps the
    // running session's clock honest and stops the moment the popup closes.
    const timer = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const openDashboard = (hash = '') => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${hash}`) });
    window.close();
  };

  const top = stats?.domains.slice(0, 4) ?? [];

  return (
    <div className="flex w-[19rem] flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <span className="text-xs font-semibold tracking-tight">{BRANDING.name}</span>
        <button
          type="button"
          onClick={() => openDashboard('#/settings')}
          aria-label="Open settings"
          className="rounded p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <GearIcon />
        </button>
      </header>

      <div className="px-4 pb-4 pt-3">
        <p className="panel-heading">Today</p>
        <p className="tnum mt-1 text-3xl font-semibold tracking-tight">
          {stats ? formatDuration(stats.totalMs) : '—'}
        </p>
        <p className="mt-0.5 text-xs text-ink-secondary">browser time</p>
      </div>

      <div className="border-t border-line px-4 py-3">
        {live?.current ? (
          <>
            <p className="panel-heading">Currently</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Favicon domain={live.current.domain} size={18} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {domainLabel(live.current.domain)}
              </span>
              <span className="tnum text-sm text-ink-secondary">
                {formatDuration(live.current.elapsed)}
              </span>
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 text-xs text-ink-secondary">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-ink-muted"
            />
            {live ? (IDLE_COPY[live.reason ?? 'untrackable']) : 'Checking…'}
          </p>
        )}
      </div>

      {top.length > 0 && settings && (
        <div className="border-t border-line px-4 py-3">
          <p className="panel-heading mb-2">Top websites</p>
          <ul className="flex flex-col gap-1.5">
            {top.map((entry) => (
              <li key={entry.domain}>
                <button
                  type="button"
                  onClick={() => openDashboard(`#/websites/${encodeURIComponent(entry.domain)}`)}
                  className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded px-1.5
                    py-1 text-left transition-colors hover:bg-surface-hover"
                >
                  <Favicon domain={entry.domain} size={16} />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {domainLabel(entry.domain)}
                  </span>
                  <span className="tnum text-xs text-ink-secondary">
                    {formatDuration(entry.ms)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats && stats.totalMs === 0 && (
        <div className="border-t border-line px-4 py-6 text-center">
          <p className="text-xs text-ink-secondary">
            No browser activity yet today.
          </p>
        </div>
      )}

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => openDashboard()}
          className="w-full rounded border border-line bg-surface py-1.5 text-xs font-medium
            text-ink transition-colors hover:bg-surface-hover"
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7L5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
