import { Button } from '../../shared/ui/primitives';

interface ErrorStateProps {
  onRetry: () => void;
}

/**
 * Shown when a storage read fails. Deliberately says nothing about the
 * underlying error - a stack trace is not actionable for the person reading it,
 * and the details are already in the console for a developer.
 */
export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div>
        <p className="text-base font-medium text-ink">
          Something went wrong loading your statistics.
        </p>
        <p className="mt-1 text-sm text-ink-secondary">
          Your recorded data is still stored on this device.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
