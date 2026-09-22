import { Panel, Skeleton } from '../../shared/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { SessionList } from '../components/SessionList';
import { ErrorState } from '../components/ErrorState';
import { useSessions, useSettings, useToday } from '../useStats';
import { addDays, type DateKey } from '../../utils/date';
import { formatDateLabel } from '../../utils/format';
import { useState } from 'react';

export function Sessions() {
  const today = useToday();
  const [date, setDate] = useState<DateKey>(today);
  const { data: sessions, loading, error, refresh } = useSessions(date);
  const { data: settings } = useSettings();

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every continuous stretch of attention, grouped by site."
        aside={
          <div className="flex items-center gap-1">
            <DateStepButton label="Previous day" onClick={() => setDate(addDays(date, -1))}>
              ←
            </DateStepButton>
            <span className="min-w-[7rem] text-center text-xs font-medium text-ink">
              {formatDateLabel(date, today)}
            </span>
            <DateStepButton
              label="Next day"
              disabled={date >= today}
              onClick={() => setDate(addDays(date, 1))}
            >
              →
            </DateStepButton>
          </div>
        }
      />

      {error ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <Panel className="px-6 py-5 animate-rise">
          {loading || !settings ? (
            <div className="flex flex-col gap-5">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <SessionList sessions={sessions ?? []} settings={settings} />
          )}
        </Panel>
      )}
    </>
  );
}

function DateStepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-line px-2 py-1 text-xs text-ink-secondary
        transition-colors hover:bg-surface-hover hover:text-ink
        disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
