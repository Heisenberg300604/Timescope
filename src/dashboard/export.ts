/**
 * Data export.
 *
 * Both formats are produced in-page from a blob - nothing is uploaded, and the
 * export works offline like everything else. The file contains exactly what the
 * extension stores: domains, categories, timestamps and durations.
 */
import type { ExportBundle } from '../storage/repository';
import { toDateKey } from '../utils/date';
import { resolveCategoryId } from '../categories/resolver';

export type ExportFormat = 'json' | 'csv';

export function buildExport(bundle: ExportBundle, format: ExportFormat): Blob {
  if (format === 'csv') {
    return new Blob([toCsv(bundle)], { type: 'text/csv;charset=utf-8' });
  }
  return new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
}

/** One row per session, the shape a spreadsheet can pivot on directly. */
function toCsv(bundle: ExportBundle): string {
  const header = ['date', 'domain', 'category', 'start_time', 'end_time', 'duration_ms', 'duration_minutes'];
  const rows: string[][] = [header];

  for (const day of bundle.days) {
    for (const session of day.sessions) {
      rows.push([
        day.date,
        session.domain,
        resolveCategoryId(session.domain, bundle.settings.domainCategories),
        new Date(session.startTime).toISOString(),
        new Date(session.endTime).toISOString(),
        String(session.duration),
        (session.duration / 60_000).toFixed(2),
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

/** Quote any cell containing a delimiter, quote or newline, per RFC 4180. */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL once the browser has had a chance to start the save.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(format: ExportFormat): string {
  return `timescope-${toDateKey(Date.now())}.${format}`;
}
