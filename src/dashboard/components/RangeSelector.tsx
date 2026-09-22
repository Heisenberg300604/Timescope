/**
 * The date-range control. A segmented control rather than a dropdown: three
 * options are faster to hit directly than to open and choose.
 */
import type { RangeId } from '../useStats';

const OPTIONS: { id: RangeId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 days' },
];

interface RangeSelectorProps {
  value: RangeId;
  onChange: (next: RangeId) => void;
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors
              ${selected
                ? 'bg-surface-hover text-ink'
                : 'text-ink-secondary hover:text-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
