/**
 * Browser time per day across a range.
 *
 * Vertical bars with the weekday beneath each. The y-axis is deliberately
 * absent: a single reference line at the range's daily average communicates
 * "more or less than usual" better than gridlines, and keeps the chart quiet.
 */
import { useState } from 'react';
import { formatDateLabel, formatDuration, formatWeekdayShort } from '../../utils/format';
import type { DateKey } from '../../utils/date';

interface DailyTrendProps {
  daily: { date: DateKey; totalMs: number }[];
  today: DateKey;
  onSelectDate?: (date: DateKey) => void;
}

export function DailyTrend({ daily, today, onSelectDate }: DailyTrendProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...daily.map((d) => d.totalMs), 1);
  const daysWithData = daily.filter((d) => d.totalMs > 0);
  const average =
    daysWithData.length > 0
      ? daysWithData.reduce((sum, d) => sum + d.totalMs, 0) / daysWithData.length
      : 0;

  return (
    <div>
      <div className="relative flex h-40 items-end gap-2">
        {average > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
            style={{ bottom: `${(average / max) * 100}%` }}
          >
            <span className="absolute -top-4 right-0 text-2xs text-ink-muted">
              avg {formatDuration(average)}
            </span>
          </div>
        )}

        {daily.map((day) => {
          const isToday = day.date === today;
          const isHovered = hovered === day.date;
          const height = day.totalMs > 0 ? Math.max(2, (day.totalMs / max) * 100) : 1;
          const Tag = onSelectDate ? 'button' : 'div';

          return (
            <Tag
              key={day.date}
              {...(onSelectDate
                ? {
                    type: 'button' as const,
                    onClick: () => onSelectDate(day.date),
                    'aria-label': `${formatDateLabel(day.date, today)}: ${formatDuration(day.totalMs)}`,
                  }
                : {})}
              onMouseEnter={() => setHovered(day.date)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(day.date)}
              onBlur={() => setHovered(null)}
              className="group relative flex h-full flex-1 items-end rounded-sm"
            >
              <div
                className="w-full rounded-t-sm transition-colors"
                style={{
                  height: `${height}%`,
                  background:
                    day.totalMs > 0
                      ? isHovered
                        ? 'var(--accent)'
                        : isToday
                          ? 'var(--accent)'
                          : 'var(--cat-0)'
                      : 'var(--line)',
                  opacity: day.totalMs > 0 && !isHovered && !isToday ? 0.5 : 1,
                }}
              />
              {isHovered && day.totalMs > 0 && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2
                    -translate-x-1/2 whitespace-nowrap rounded border border-line
                    bg-surface-raised px-2 py-1 text-2xs text-ink shadow-sm"
                >
                  {formatDateLabel(day.date, today)}
                  <span className="mx-1 text-ink-muted">·</span>
                  <span className="tnum">{formatDuration(day.totalMs)}</span>
                </div>
              )}
            </Tag>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {daily.map((day) => (
          <span
            key={day.date}
            className={`flex-1 text-center text-2xs ${
              day.date === today ? 'font-medium text-ink' : 'text-ink-muted'
            }`}
          >
            {formatWeekdayShort(day.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
