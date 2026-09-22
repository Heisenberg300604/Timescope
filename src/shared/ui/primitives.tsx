/**
 * The small set of primitives the whole product is built from.
 *
 * Kept in one file on purpose: each is a handful of lines, and splitting them
 * across nine files would make the design system harder to read, not easier.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// -- Panel -------------------------------------------------------------------

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`panel ${className}`}>{children}</section>;
}

interface PanelHeaderProps {
  title: string;
  /** Right-aligned content: a total, a control, a link. */
  aside?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, aside, className = '' }: PanelHeaderProps) {
  return (
    <header className={`flex items-baseline justify-between gap-4 ${className}`}>
      <h2 className="panel-heading">{title}</h2>
      {aside}
    </header>
  );
}

// -- Button ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink border-accent hover:bg-accent-hover',
  secondary:
    'bg-surface text-ink border-control-line hover:bg-surface-hover',
  ghost:
    'bg-transparent text-ink-secondary border-transparent hover:bg-surface-hover hover:text-ink',
  danger:
    'bg-transparent text-danger border-danger/40 hover:bg-danger-soft',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded border px-3 py-1.5
        text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50
        ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// -- Toggle ------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Rendered visibly by the caller, referenced here. */
  label: string;
  id: string;
}

/**
 * A real checkbox under the visual switch, so it is keyboard operable and
 * announced correctly without any ARIA bookkeeping.
 */
export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label htmlFor={id} className="relative inline-flex cursor-pointer items-center">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="h-5 w-9 rounded-full border transition-colors
          peer-focus-visible:outline peer-focus-visible:outline-2
          peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        style={{
          background: checked ? 'var(--accent)' : 'var(--surface-hover)',
          borderColor: checked ? 'var(--accent)' : 'var(--control-line)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-white
          shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'none' }}
      />
    </label>
  );
}

// -- Empty state -------------------------------------------------------------

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Kept compact for use inside a panel rather than a whole page. */
  compact?: boolean;
  action?: ReactNode;
}

export function EmptyState({ title, description, compact, action }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      <p className="text-base font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// -- Loading -----------------------------------------------------------------

/**
 * A skeleton block. Deliberately still - a shimmer on a view that usually
 * resolves in under 50ms is more distracting than the wait it covers.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded bg-surface-hover ${className}`}
    />
  );
}

// -- Category dot ------------------------------------------------------------

/**
 * The category identity mark. Always accompanied by the category's name in
 * text - color never carries meaning alone.
 */
export function CategoryDot({ colorIndex, className = '' }: { colorIndex: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ background: `var(--cat-${colorIndex})` }}
    />
  );
}
