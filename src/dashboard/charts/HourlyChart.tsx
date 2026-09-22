/**
 * Browser activity across the day.
 *
 * Twenty-four bars on a shared baseline. The point is the SHAPE - when the
 * day is busy - so the bars are unlabelled and recessive, with exact values on
 * hover. Axis labels appear every six hours; labelling all 24 would be noise at
 * this width.
 */
import { useState } from 'react';
import { formatDuration } from '../../utils/format';

interface HourlyChartProps {
  hourly: number[];
  /** Highlights the current hour. Omitted for historical ranges. */
  currentHour?: number;
}

const HOUR_LABELS = [0, 6, 12, 18];

export function HourlyChart({ hourly, currentHour }: HourlyChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...hourly, 1);
  const hasData = hourly.some((ms) => ms > 0);

  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]" role="group" aria-label="Hourly browser activity">
        {hourly.map((ms, hour) => {
          const height = hasData ? Math.max(ms > 0 ? 3 : 1, (ms / max) * 100) : 1;
          const isCurrent = hour === currentHour;
          const isHovered = hovered === hour;
          return (
            <div
              key={hour}
              className="group relative flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHovered(hour)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="w-full rounded-sm transition-colors"
                style={{
                  height: `${height}%`,
                  background:
                    ms > 0
                      ? isHovered || isCurrent
                        ? 'var(--accent)'
                        : 'var(--cat-0)'
                      : 'var(--line)',
                  opacity: ms > 0 && !isHovered && !isCurrent ? 0.55 : 1,
                }}
              />
              {isHovered && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2
                    -translate-x-1/2 whitespace-nowrap rounded border border-line
                    bg-surface-raised px-2 py-1 text-2xs text-ink shadow-sm"
                >
                  <span className="tnum">{formatHour(hour)}</span>
                  <span className="mx-1 text-ink-muted">·</span>
                  <span className="tnum">{ms > 0 ? formatDuration(ms) : 'no activity'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-2xs text-ink-muted">
        {HOUR_LABELS.map((hour) => (
          <span key={hour} className="tnum">{formatHour(hour)}</span>
        ))}
        <span className="tnum">{formatHour(23)}</span>
      </div>
    </div>
  );
}

/** `09:00`, following the locale's 12/24-hour convention. */
function formatHour(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric' });
}
