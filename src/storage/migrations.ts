/**
 * Schema migrations.
 *
 * V1 is the first released schema, so there is nothing to migrate yet. The
 * machinery exists now so that a future version can reshape stored records
 * without guessing at what an older install looks like: `initialize()` compares
 * `meta.schemaVersion` against `SCHEMA_VERSION` and replays every step in
 * between.
 *
 * To add a migration, append an entry whose `to` is the new version and whose
 * `run` transforms storage in place. Steps must be idempotent - a worker can be
 * killed partway through.
 */

import type { StorageArea } from './area';

interface Migration {
  /** Schema version this step produces. */
  to: number;
  run: (area: StorageArea) => Promise<void>;
}

const MIGRATIONS: Migration[] = [];

export async function runMigrations(area: StorageArea, fromVersion: number): Promise<void> {
  for (const migration of MIGRATIONS) {
    if (migration.to > fromVersion) {
      await migration.run(area);
    }
  }
}
