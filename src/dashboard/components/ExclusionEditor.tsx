import { useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/primitives';
import { normalizeExclusionPattern } from '../../utils/exclusions';

interface ExclusionEditorProps {
  excluded: string[];
  onChange: (next: string[]) => void;
}

export function ExclusionEditor({ excluded, onChange }: ExclusionEditorProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const pattern = normalizeExclusionPattern(draft);
    if (!pattern) {
      setError('Enter a domain, for example localhost or example.com.');
      return;
    }
    if (excluded.includes(pattern)) {
      setError(`${pattern} is already excluded.`);
      return;
    }
    setError(null);
    setDraft('');
    onChange([...excluded, pattern]);
  };

  return (
    <div>
      <form onSubmit={add} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          placeholder="localhost"
          aria-label="Domain to exclude"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'exclusion-error' : undefined}
          className="min-w-0 flex-1 rounded border border-control-line bg-surface px-2.5 py-1.5
            text-sm text-ink placeholder:text-ink-muted"
        />
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>

      {error && (
        <p id="exclusion-error" role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      {excluded.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {excluded.map((pattern) => (
            <li key={pattern}>
              <span
                className="inline-flex items-center gap-1.5 rounded border border-line
                  bg-surface-hover py-1 pl-2.5 pr-1 text-xs text-ink"
              >
                <span className="font-mono">{pattern}</span>
                <button
                  type="button"
                  onClick={() => onChange(excluded.filter((item) => item !== pattern))}
                  aria-label={`Stop excluding ${pattern}`}
                  className="rounded px-1 text-ink-muted transition-colors hover:text-danger"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">No websites are excluded.</p>
      )}
    </div>
  );
}
