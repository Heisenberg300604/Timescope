import { Panel, Skeleton } from '../../shared/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { RangeSelector } from '../components/RangeSelector';
import { WebsiteList } from '../components/WebsiteList';
import { ErrorState } from '../components/ErrorState';
import { resolveRange, useRangeStats, useSettings, useToday, type RangeId } from '../useStats';
import { formatDuration } from '../../utils/format';

interface WebsitesProps {
  rangeId: RangeId;
  onRangeChange: (next: RangeId) => void;
}

export function Websites({ rangeId, onRangeChange }: WebsitesProps) {
  const today = useToday();
  const range = resolveRange(rangeId, today);
  const { data: stats, loading, error, refresh } = useRangeStats(range);
  const { data: settings } = useSettings();

  return (
    <>
      <PageHeader
        title="Websites"
        description={
          stats
            ? `${stats.domains.length} ${stats.domains.length === 1 ? 'site' : 'sites'} · ${formatDuration(stats.totalMs)} total`
            : range.label
        }
        aside={<RangeSelector value={rangeId} onChange={onRangeChange} />}
      />

      {error ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <Panel className="px-6 py-4 animate-rise">
          {loading || !stats || !settings ? (
            <div className="flex flex-col gap-4 py-2">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <WebsiteList
              domains={stats.domains}
              totalMs={stats.totalMs}
              settings={settings}
              emptyTitle="No browser activity yet"
              emptyDescription="Once you start browsing, your activity will appear here."
            />
          )}
        </Panel>
      )}
    </>
  );
}
