/**
 * A seven-day sparkline for one site, used on the website detail page.
 *
 * Bars rather than a line: seven discrete days are not a continuous series, and
 * bars read honestly at this size without implying values between them.
 */
import { formatDateLabel, formatDuration } from '../../utils/format';
import type { DateKey } from '../../utils/date';

interface SparklineProps {
  points: { date: DateKey; ms: number }[];
  today: DateKey;
}

export function Sparkline({ points, today }: SparklineProps) {
  const max = Math.max(...points.map((p) => p.ms), 1);

  return (
    <div>
      <div className="flex h-20 items-end gap-1.5">
        {points.map((point) => (
          <div
            key={point.date}
            className="flex h-full flex-1 items-end"
            title={`${formatDateLabel(point.date, today)}: ${formatDuration(point.ms)}`}
          >
            <div
              className="w-full rounded-sm"
              style={{
                height: `${point.ms > 0 ? Math.max(3, (point.ms / max) * 100) : 1}%`,
                background: point.ms > 0 ? 'var(--cat-0)' : 'var(--line)',
                opacity: point.date === today ? 1 : 0.6,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {points.map((point) => (
          <span key={point.date} className="flex-1 text-center text-2xs text-ink-muted">
            {new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </span>
        ))}
      </div>
    </div>
  );
}
