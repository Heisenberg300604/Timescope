/**
 * One site, in detail.
 *
 * Four numbers and a seven-day shape. The restraint is deliberate: total,
 * session count, average and longest are the metrics that change how someone
 * reads their own behaviour, and adding more would dilute them.
 */
import { Panel, PanelHeader, Skeleton } from '../../shared/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ErrorState } from '../components/ErrorState';
import { Sparkline } from '../charts/Sparkline';
import { SessionList } from '../components/SessionList';
import { Favicon } from '../../shared/ui/Favicon';
import { CategoryDot } from '../../shared/ui/primitives';
import { hrefFor } from '../router';
import { useDomainHistory, useSessions, useSettings, useToday } from '../useStats';
import { createCategoryLookup, domainLabel } from '../../categories/resolver';
import { formatDuration, formatDurationPrecise } from '../../utils/format';

export function WebsiteDetail({ domain }: { domain: string }) {
  const today = useToday();
  const { data: sessions, loading, error, refresh } = useSessions(today);
  const { data: history } = useDomainHistory(domain, today);
  const { data: settings } = useSettings();

  const forDomain = (sessions ?? []).filter((session) => session.domain === domain);
  const totalMs = forDomain.reduce((sum, session) => sum + session.duration, 0);
  const longest = forDomain.reduce((max, session) => Math.max(max, session.duration), 0);
  const average = forDomain.length > 0 ? totalMs / forDomain.length : 0;
  const category = settings ? createCategoryLookup(settings)(domain) : null;

  if (error) return <ErrorState onRetry={refresh} />;

  return (
    <>
      <nav className="mb-6">
        <a
          href={hrefFor({ name: 'websites' })}
          className="text-xs text-ink-secondary hover:text-ink"
        >
          <span aria-hidden="true">←</span> All websites
        </a>
      </nav>

      <PageHeader
        title={domainLabel(domain)}
        description={domain}
        aside={<Favicon domain={domain} size={36} className="rounded-md" />}
      />

      {category && (
        <p className="-mt-4 mb-8 flex items-center gap-1.5 text-xs text-ink-secondary">
          <CategoryDot colorIndex={category.colorIndex} />
          {category.label}
        </p>
      )}

      <div className="flex flex-col gap-4 animate-rise">
        <Panel className="grid grid-cols-2 gap-6 px-6 py-5 sm:grid-cols-4">
          {loading ? (
            [0, 1, 2, 3].map((cell) => (
              <div key={cell}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-6 w-20" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Today" value={formatDuration(totalMs)} />
              <StatCard label="Sessions" value={String(forDomain.length)} />
              <StatCard
                label="Average session"
                value={forDomain.length ? formatDurationPrecise(average) : '–'}
              />
              <StatCard
                label="Longest session"
                value={forDomain.length ? formatDuration(longest) : '–'}
              />
            </>
          )}
        </Panel>

        <Panel className="px-6 py-5">
          <PanelHeader title="Usage over the last 7 days" className="mb-5" />
          {history ? (
            <Sparkline points={history} today={today} />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </Panel>

        <Panel className="px-6 py-5">
          <PanelHeader title="Today's sessions" className="mb-4" />
          {loading || !settings ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <SessionList sessions={forDomain} settings={settings} />
          )}
        </Panel>
      </div>
    </>
  );
}
