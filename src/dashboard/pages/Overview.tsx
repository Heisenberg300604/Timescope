/**
 * The overview: the answer to "where did my browser time go?" in one screen.
 *
 * Reading order is deliberate - the total, then how it divides by category,
 * then which sites, then when in the day. Each answers the next question the
 * previous one raises.
 */
import { Panel, PanelHeader, Skeleton } from '../../shared/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { RangeSelector } from '../components/RangeSelector';
import { StatCard } from '../components/StatCard';
import { WebsiteList } from '../components/WebsiteList';
import { ErrorState } from '../components/ErrorState';
import { CategoryBars } from '../charts/CategoryBars';
import { HourlyChart } from '../charts/HourlyChart';
import { DailyTrend } from '../charts/DailyTrend';
import { hrefFor } from '../router';
import { resolveRange, useRangeStats, useSettings, useToday, type RangeId } from '../useStats';
import { formatDuration, greeting } from '../../utils/format';

interface OverviewProps {
  rangeId: RangeId;
  onRangeChange: (next: RangeId) => void;
}

export function Overview({ rangeId, onRangeChange }: OverviewProps) {
  const today = useToday();
  const range = resolveRange(rangeId, today);
  const { data: stats, loading, error, refresh } = useRangeStats(range);
  const { data: settings } = useSettings();

  const isToday = rangeId === 'today';
  const description = isToday
    ? "Here's where your browser time went today."
    : `Your browser activity for ${range.label.toLowerCase()}.`;

  return (
    <>
      <PageHeader
        title={isToday ? `${greeting()}.` : range.label}
        description={description}
        aside={<RangeSelector value={rangeId} onChange={onRangeChange} />}
      />

      {error && <ErrorState onRetry={refresh} />}

      {!error && (
        <div className="flex flex-col gap-4 animate-rise">
          <Panel className="px-6 py-6">
            {loading ? (
              <>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-3 h-10 w-44" />
              </>
            ) : (
              <StatCard
                emphasis
                label="Total browser time"
                value={formatDuration(stats?.totalMs ?? 0)}
                detail={
                  rangeId === 'week' && stats
                    ? `${range.label} · ${formatDuration(stats.totalMs / 7)} daily average`
                    : range.label
                }
              />
            )}
          </Panel>

          {rangeId === 'week' && stats && stats.totalMs > 0 && (
            <Panel className="px-6 py-5">
              <PanelHeader title="Daily total" className="mb-5" />
              <DailyTrend daily={stats.daily} today={today} />
            </Panel>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="px-6 py-5">
              <PanelHeader title="Time by category" className="mb-5" />
              {loading || !stats ? (
                <SkeletonRows />
              ) : (
                <CategoryBars categories={stats.categories} totalMs={stats.totalMs} />
              )}
            </Panel>

            <Panel className="px-6 py-5">
              <PanelHeader
                title="Top websites"
                className="mb-3"
                aside={
                  stats && stats.domains.length > 5 ? (
                    <a
                      href={hrefFor({ name: 'websites' })}
                      className="text-xs text-accent hover:underline"
                    >
                      View all {stats.domains.length}
                    </a>
                  ) : null
                }
              />
              {loading || !stats || !settings ? (
                <SkeletonRows />
              ) : (
                <WebsiteList
                  domains={stats.domains}
                  totalMs={stats.totalMs}
                  settings={settings}
                  limit={5}
                  emptyTitle="No browser activity yet"
                  emptyDescription="Once you start browsing, your activity will appear here."
                />
              )}
            </Panel>
          </div>

          <Panel className="px-6 py-5">
            <PanelHeader
              title={rangeId === 'week' ? 'Activity by hour, across the week' : 'Browser activity'}
              className="mb-5"
            />
            {loading || !stats ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <HourlyChart
                hourly={stats.hourly}
                currentHour={isToday ? new Date().getHours() : undefined}
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2, 3].map((row) => (
        <div key={row}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}
