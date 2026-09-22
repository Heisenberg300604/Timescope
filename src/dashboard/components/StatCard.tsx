import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  /** Small qualifier beneath the number: a range, a count, a comparison. */
  detail?: ReactNode;
  /** The hero metric renders larger; used once per page at most. */
  emphasis?: boolean;
}

export function StatCard({ label, value, detail, emphasis }: StatCardProps) {
  return (
    <div>
      <p className="panel-heading">{label}</p>
      <p
        className={`tnum mt-2 font-semibold tracking-tight text-ink ${
          emphasis ? 'text-4xl' : 'text-xl'
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-ink-secondary">{detail}</p>}
    </div>
  );
}
