import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  aside?: ReactNode;
}

export function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
      </div>
      {aside}
    </header>
  );
}
