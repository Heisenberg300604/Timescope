/**
 * Sessions grouped by site.
 *
 * The grouping matters: a flat chronological list answers "what did I do at
 * 3pm", but the question this page exists for is "how was my time on this site
 * distributed" - so each site carries its total and session count, with the
 * individual sessions beneath.
 */
import type { Session, Settings } from '../../types';
import { formatClockTime, formatDuration } from '../../utils/format';
import { createCategoryLookup, domainLabel } from '../../categories/resolver';
import { Favicon } from '../../shared/ui/Favicon';
import { CategoryDot, EmptyState } from '../../shared/ui/primitives';
import { hrefFor } from '../router';

interface SessionGroup {
  domain: string;
  totalMs: number;
  sessions: Session[];
}

/** Group a day's sessions by site, ordered by total time spent. */
export function groupSessions(sessions: Session[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();

  for (const session of sessions) {
    const existing = groups.get(session.domain);
    if (existing) {
      existing.totalMs += session.duration;
      existing.sessions.push(session);
    } else {
      groups.set(session.domain, {
        domain: session.domain,
        totalMs: session.duration,
        sessions: [session],
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => b.startTime - a.startTime),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

interface SessionListProps {
  sessions: Session[];
  settings: Settings;
}

export function SessionList({ sessions, settings }: SessionListProps) {
  const groups = groupSessions(sessions);
  const categoryOf = createCategoryLookup(settings);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No sessions recorded"
        description="Sessions appear here as you browse."
      />
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {groups.map((group) => {
        const category = categoryOf(group.domain);
        return (
          <section key={group.domain} className="py-4 first:pt-0 [&+section]:border-t [&+section]:border-line">
            <header className="flex items-center gap-3">
              <Favicon domain={group.domain} size={20} />
              <div className="min-w-0 flex-1">
                <a
                  href={hrefFor({ name: 'website', domain: group.domain })}
                  className="text-sm font-medium text-ink hover:text-accent"
                >
                  {domainLabel(group.domain)}
                </a>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-muted">
                  <CategoryDot colorIndex={category.colorIndex} />
                  {category.label}
                  <span aria-hidden="true">·</span>
                  {group.sessions.length}
                  {group.sessions.length === 1 ? ' session' : ' sessions'}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-medium text-ink">
                {formatDuration(group.totalMs)}
              </span>
            </header>

            <ul className="mt-2.5 flex flex-col gap-1 pl-8">
              {group.sessions.map((session) => (
                <li
                  key={`${session.startTime}-${session.endTime}`}
                  className="flex items-baseline justify-between gap-4 text-xs"
                >
                  <span className="tnum text-ink-secondary">
                    {formatClockTime(session.startTime)}
                    <span className="mx-1.5 text-ink-muted" aria-hidden="true">–</span>
                    {formatClockTime(session.endTime)}
                  </span>
                  <span className="tnum text-ink-muted">{formatDuration(session.duration)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
