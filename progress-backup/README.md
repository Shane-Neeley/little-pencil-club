# Lesson completion backup prototype

This local prototype for [issue #7](https://github.com/Shane-Neeley/little-pencil-club/issues/7) accepts three synthetic lesson IDs. The demo uses its own browser storage and the tests use ephemeral Workerd D1.

## Default off

The default demo shows local completion controls and makes zero backup requests. To exercise the optional controls, the local test harness sets `data-progress-backup="enabled"` on the demo HTML. The page performs no startup availability request. A backup request requires a save, restore, or delete action.

The Worker and cleanup handler are off unless the runtime sets `PROGRESS_BACKUP_ENABLED` to the exact string `true`. While off, the backup routes return a generic 404 and the cleanup handler exits without accessing storage. The enabled Worker requires a separate `PROGRESS_DB` D1 binding with the Sessions API and `migrations/0001_progress.sql` already applied. It returns a generic 503 for an unavailable or unmigrated binding. The production game, Sites manifest, and classroom storage have no dependency on this prototype.

## Run local tests

Use Node.js 24. Chromium is optional for the browser checks. Install the test tools into a temporary directory, outside the project dependencies.

```sh
progress_test_deps=$(mktemp -d)
npm install --prefix "$progress_test_deps" --no-save --no-package-lock \
  miniflare@4.20260730.0 jsdom@26.1.0 playwright-core@1.56.1
PROGRESS_TEST_DEPS="$progress_test_deps" \
  node --test progress-backup/test/progress.test.mjs
```

The harness opts in and applies the SQL migration to local, ephemeral Workerd D1. It exercises the demo in two independent DOM clients. Set `PROGRESS_TEST_CHROMIUM=/usr/bin/chromium` to also run recovery in two isolated Chromium contexts and a completion checkmark smoke test against the existing `dist/` files. The harness routes requests locally and discards its browser storage and D1 data when it finishes.

## Recovery codes and deletion

- **Save a backup** creates a separate snapshot and new 256-bit recovery code on every explicit save. Earlier codes still point to their own snapshots. The code appears temporarily in the demo and clears on dismiss or page exit. If the save commits before a response is abandoned or lost, that snapshot can remain until expiry and cleanup.
- **Bring back my progress** sends the code only in a same-origin HTTPS POST body. The client clears the entered value when it takes the request, omits cookies and referrers, blocks redirects, and keeps only sample completion IDs in browser storage. Backup responses use `Cache-Control: private, no-store, max-age=0`.
- **Delete backup** deletes that code's row. The Worker verifies the row's absence in the same D1 session before returning success. A separate restore starts with `withSession('first-primary')` so the lookup sees committed deletions across clients. No session bookmark is sent to the browser. Malformed, unknown, deleted, and expired codes all return the same unavailable response. Already-restored completion stays on each device. An interrupted confirmation can report a failure after the deletion has committed. [D1 Sessions API](https://developers.cloudflare.com/d1/worker-api/d1-database/#withsession)
- `PROGRESS_DB` holds the code's SHA-256 digest, schema version, an allowlisted array of completion IDs, and expiration. It also holds three aggregate request counters. The prototype caps storage at 1,000 rows and allows 20 saves, 60 restores, and 20 deletions per minute across all clients. Shared limits avoid storing requester identifiers and can delay legitimate requests during a burst.
- The application emits no request, response, or recovery-code logs. The fixed URLs never contain a code, and the local harness turns off request logging. Cloudflare invocation logs can include request URLs and request and response metadata. Cloudflare documents three days of Workers Logs retention on Free and seven days on Paid. Verify actual Sites gateway and Worker instrumentation, traces, exports, redaction, and retention before enabling any hosted use. [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

## Expiry and provider backups

A backup becomes inaccessible at 30 days, even while an expired row still exists. A valid save request sweeps up to 100 expired rows before attempting its insert. The `scheduled()` handler runs the same bounded sweep when invoked manually by the local tests. No recurring trigger is configured. In an idle local instance, expired rows can remain until a save, an explicit sweep, or teardown. A hosted implementation needs a verified recurring cleanup path with enough throughput to clear the backlog, including while the backup UI is disabled.

Deleting a live row ends normal recovery once the change is committed. Cloudflare D1 Time Travel history may retain earlier row versions for seven days on Free or 30 days on Paid. Check the actual provider plan and any other copies or exports before promising a physical erasure window. Before reconnecting a point-in-time restored database to the feature, exclude backups that were revoked or expired. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

## Before integrating grown-up Settings

1. Keep the Settings controls off until the separate progress store and privacy controls are verified. Confirm the actual Sites deployment can bind a physically separate progress D1, apply the migration, and serve same-origin HTTPS without changing public play or classroom access. Keep the synthetic demo outside the published assets.
2. Replace the fixture catalog with reviewed stable lesson IDs and define a schema compatibility policy. Save only completed lesson IDs, using the effective local completion state at the moment the grown-up chooses to save.
3. Restore into completion-only markers keyed by lesson ID, separate from the game's drawing records. Set only missing markers after the response arrives, and have completion views read them alongside existing completion timestamps. Separate per-lesson markers allow restores from multiple tabs to add completion independently. A restore should never write a cached drawing record or replace an active session. The existing autosave owns strokes, the current step, the selected drawing mode, and existing completion timestamps. Refresh completion indicators without restarting an active drawing.
4. Verify the recurring cleanup and provider log and backup behavior. Validate the disabled path, two-browser recovery, stale and in-flight restores, continued drawing autosave, and iPad Safari with synthetic progress before enabling Settings.
