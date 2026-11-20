
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

// This module is for tests and localhost preview. It has no remote bindings.
export const localOwnerId = 'fixture-local-owner';

export function localWorker(persist, overrides = {}) {
  return new Miniflare({
    host: '127.0.0.1',
    modules: true,
    scriptPath: 'dist/server/index.js',
    compatibilityDate: '2026-07-30',
    d1Databases: { DB: 'classroom-local' },
    r2Buckets: { BUCKET: 'classroom-local' },
    d1Persist: persist,
    r2Persist: persist,
    bindings: {
      CLASSROOM_SYNTHETIC_ENABLED: '1',
      CLASSROOM_ADMIN_USER_ID: localOwnerId,
    },
    ...overrides,
  });
}

export async function initLocalDatabase(db) {
  const found = await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'classes'").first();
  if (found) return;
  const migration = await readFile('drizzle/0000_classroom.sql', 'utf8');
  await db.batch(migration.split('--> statement-breakpoint').map(sql => db.prepare(sql.trim())));
}
