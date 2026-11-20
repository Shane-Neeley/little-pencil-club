# Lesson completion backup prototype

This is the local, synthetic-data prototype for [issue #7](https://github.com/Shane-Neeley/little-pencil-club/issues/7). The demo has its own sample lessons and browser storage. The Worker accepts only the three sample IDs.

## Run local tests

Use Node.js 24. Chromium is optional for the browser checks. Install the test tools into a temporary directory, outside the project dependencies.

```sh
progress_test_deps=$(mktemp -d)
npm install --prefix "$progress_test_deps" --no-save --no-package-lock \
  miniflare@4.20260730.0 jsdom@26.1.0 playwright-core@1.56.1
PROGRESS_TEST_DEPS="$progress_test_deps" \
  node --test progress-backup/test/progress.test.mjs
```

The harness applies the SQL migration to an ephemeral Workerd D1 database and exercises the demo in two independent DOM clients. Set `PROGRESS_TEST_CHROMIUM=/usr/bin/chromium` to also run recovery in two isolated Chromium contexts and a completion checkmark smoke test against the existing `dist/` files. The harness routes requests locally and discards its browser storage and D1 data when it finishes.

## Data and lifecycle

- **Save a backup** creates a snapshot on an explicit action. The Worker generates a 256-bit recovery code and returns it once. A later save creates a separate snapshot and code.
- **Bring back my progress** sends the code in a same-origin HTTPS JSON request body. The client merges the returned completion IDs with the current local set when the response arrives.
- **Delete backup** revokes the code by deleting its row. The Worker returns the same unavailable response for malformed, unknown, deleted, and expired codes. Local completion remains usable independently of a backup.
- `PROGRESS_DB` holds the code's SHA-256 digest, schema version, an allowlisted array of completion IDs, and the expiration time. It has three aggregate request counters by action and time window. Requests and storage carry no user, device, classroom, drawing, or analytics fields.
- A backup stops working after 30 days. Valid saves remove up to 100 expired rows. A scheduled handler can run the same sweep independently of traffic. The prototype caps storage at 1,000 rows and accepts up to 20 saves, 60 restores, and 20 deletions per minute across all clients. Shared limits keep requester identifiers out of storage and can delay legitimate requests during a burst.
- The API has only fixed POST routes for save, restore, and deletion. Responses use `Cache-Control: private, no-store, max-age=0`; the demo omits cookies, blocks redirects, and clears the entered code after each request.

## Before integrating grown-up Settings

1. Add explicit save, restore, and delete controls in grown-up Settings. Read only existing completion flags when creating the snapshot. Apply restored flags through the game's storage and in-memory state so a restore leaves drawing strokes, active steps, modes, and existing completion timestamps intact. Keep ordinary play and browser autosave available offline.
2. Replace the fixture catalog with reviewed production lesson IDs and retain stable IDs across lesson revisions. Handle old backup schema versions explicitly if the format changes.
3. Verify that the actual Sites deployment can keep progress D1 physically separate from classroom D1 and apply its schema migration. Confirm the server-backed Worker routing, same-origin HTTPS, production payload and log redaction, and primary read consistency after deletion. Keep the demo outside published assets.
4. Verify an independent cleanup schedule and the provider's retention for deleted data, including D1 Time Travel. Tune production abuse controls without retaining IPs or establishing device or classroom linkage. Verify the privacy gate and repeat the two-browser checks, including iPad Safari, with synthetic progress before enabling Settings.
