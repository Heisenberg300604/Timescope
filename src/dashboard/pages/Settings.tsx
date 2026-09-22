/**
 * Settings.
 *
 * Grouped by what the user is trying to do rather than by data shape:
 * control tracking, silence sites, organize sites, manage the data, understand
 * the privacy model.
 */
import { useState } from 'react';
import { Button, Panel, Toggle } from '../../shared/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CategoryEditor } from '../components/CategoryEditor';
import { ExclusionEditor } from '../components/ExclusionEditor';
import { useSettings } from '../useStats';
import { repository } from '../../storage/repository';
import { applyTheme } from '../../shared/theme';
import { buildExport, downloadBlob, exportFilename, type ExportFormat } from '../export';
import type { ThemePreference } from '../../types';
import { BRANDING } from '../../shared/branding';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function Settings() {
  const { data: settings, save } = useSettings();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!settings) return null;

  const announce = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus((current) => (current === message ? null : current)), 4000);
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      const bundle = await repository.exportAll();
      downloadBlob(buildExport(bundle, format), exportFilename(format));
      announce(`Exported as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error('[TimeScope] export failed', error);
      announce('Export failed. Your data is unchanged.');
    }
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    try {
      await repository.clearTrackingData();
      announce('All tracking data deleted.');
    } catch (error) {
      console.error('[TimeScope] delete failed', error);
      announce('Could not delete data. Please try again.');
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-4 animate-rise">
        <Section
          title="Tracking"
          description="Pause recording at any time. Time already recorded is kept."
        >
          <Row label="Track browser time" htmlFor="tracking-toggle">
            <Toggle
              id="tracking-toggle"
              label="Track browser time"
              checked={settings.trackingEnabled}
              onChange={(next) => void save({ trackingEnabled: next })}
            />
          </Row>

          <Row
            label="Pause after inactivity"
            description="How long the computer must be untouched before time stops counting."
            htmlFor="idle-threshold"
          >
            <select
              id="idle-threshold"
              value={settings.idleThresholdSeconds}
              onChange={(event) => void save({ idleThresholdSeconds: Number(event.target.value) })}
              className="rounded border border-control-line bg-surface px-2 py-1 text-sm text-ink"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </Row>
        </Section>

        <Section title="Appearance">
          <Row label="Theme" htmlFor="theme-select">
            <div
              role="radiogroup"
              aria-label="Theme"
              className="inline-flex rounded-md border border-line bg-surface p-0.5"
            >
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === theme.id}
                  onClick={() => {
                    applyTheme(theme.id);
                    void save({ theme: theme.id });
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    settings.theme === theme.id
                      ? 'bg-surface-hover text-ink'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section
          title="Excluded websites"
          description="Sites listed here are never recorded. Subdomains are excluded too, and a bare host such as localhost covers every port."
        >
          <ExclusionEditor
            excluded={settings.excludedDomains}
            onChange={(excludedDomains) => void save({ excludedDomains })}
          />
        </Section>

        <Section
          title="Categories"
          description="Categories are organizational labels, not judgements. Reassign any site you like."
        >
          <CategoryEditor settings={settings} onSave={save} />
        </Section>

        <Section
          title="Your data"
          description="Everything is stored on this device. Export it or remove it whenever you want."
        >
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleExport('json')}>Export JSON</Button>
            <Button onClick={() => void handleExport('csv')}>Export CSV</Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete all data
            </Button>
          </div>
          <p aria-live="polite" className="mt-3 min-h-[1rem] text-xs text-ink-secondary">
            {status}
          </p>
        </Section>

        <Section title="Privacy">
          <p className="text-sm leading-relaxed text-ink-secondary">
            Your browsing activity is stored locally on this device. {BRANDING.name} has no
            server, no account and no analytics, and makes no network requests of any kind.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            Only a website&rsquo;s domain is recorded &mdash; never full URLs, page contents,
            search queries or form data.
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete all tracking data?"
        description="This permanently removes your recorded screen-time history from this browser. Your settings, exclusions and categories are kept."
        confirmLabel="Delete everything"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="px-6 py-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-secondary">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

function Row({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-line py-2.5 [&+&]:border-t">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-ink-secondary">{description}</p>}
      </div>
      {children}
    </div>
  );
}
