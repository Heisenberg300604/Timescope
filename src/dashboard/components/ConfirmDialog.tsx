/**
 * Confirmation for destructive actions.
 *
 * Uses the native `<dialog>` element, which brings focus trapping, Escape to
 * dismiss and the top layer for free - all things a hand-rolled modal gets
 * subtly wrong.
 */
import { useEffect, useRef } from 'react';
import { Button } from '../../shared/ui/primitives';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="max-w-sm rounded-lg border border-line bg-surface p-0 text-ink
        backdrop:bg-black/40 open:animate-rise"
    >
      <div className="px-6 pb-5 pt-6">
        <h2 id="confirm-title" className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{description}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
