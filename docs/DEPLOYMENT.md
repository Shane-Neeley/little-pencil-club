# Deployment and configuration

## Public game

The published [Little Pencil Club Site](https://little-pencil-club.fort-rock.chatgpt.site/) serves the public game. The static `dist/` files work with any plain local file server. The lessons and current drawing tools use no API, account, database, or model. Sketchbook progress and saved strokes stay in that browser. Clearing site data removes them. Export a PNG to keep a separate copy.

## Classroom preview

Run from the repository root with Node.js 22 or newer.

```sh
npm ci
npm test
npm run dev
```

Open [the local classroom](http://127.0.0.1:8787/classroom). The preview starts a loopback server and uses local, simulated D1 and R2 in the ignored `.classroom-preview/` directory. It only accepts coded sample drawings. It does not open a production connection.

For adult controls, supply your own random `CLASSROOM_PREVIEW_OWNER_KEY` of at least 32 characters to the local preview process via its environment. Open [Class controls](http://127.0.0.1:8787/classroom/review), then **Sign in to manage a class**. The local browser prompt uses username `adult` and the key as its password. Create a sample class and a QR, then open the sample invite in two separate browser profiles. Select one of the sample drawings to exercise sharing, or choose the uncertain sample to observe a closed rejection. Use **Report** as a class member and **Remove** in adult controls. Stop the preview and remove `.classroom-preview/` to reset the local data.

## ChatGPT Sites Worker

The original public Site remains the public game. This branch builds a Worker candidate with `npm run build`, which writes `dist/server/index.js` while retaining the existing game files. For an authorized publication, open the canonical Site source with the official Sites helper, reconcile the current source, and use that helper to package the exact committed build and migrations. A fork must use its own Site project ID and fresh storage. Keep the owner and audience settings of any existing Site intact.

| Component | Binding and role | Verification |
| --- | --- | --- |
| ChatGPT Sites | Runs the existing game. The Worker candidate uses the documented Sites fetch entry point. | The public static Site is live. The gallery Worker was tested locally. |
| D1 | `DB` stores class deadlines, hashed invite and membership credentials, and drawing metadata. Migrations live in `drizzle/`. | The migration, queries, and persistence were exercised in a local D1 simulation. |
| R2 | `BUCKET` stores generated PNG bytes. The Worker serves them through authorized same-origin routes. | Private access at the application layer, deletion, and R2 bytes were exercised locally. Hosted binding, bucket access policy, and retention still need production verification. |

No D1 blob fallback or other storage provider adapter is shipped. An alternate store would need an implementation of the database and object operations currently used by the Worker, plus concurrency, access, deletion, and expiry tests.

### Runtime switches

- `CLASSROOM_SYNTHETIC_ENABLED` defaults to off. The value `1` enables the synthetic gallery when both storage bindings work. The server rejects arbitrary files and enrollment outside the sample workflow in every configuration.
- `CLASSROOM_ADMIN_USER_ID` is the configured adult's verified Site-scoped identity, matched server-side with the platform's `oai-authenticated-user-id`. Only the recorded owner can manage a specific sample class. Configure the identity in the Site environment and keep it out of client code and source. Verify that the exact hosted build receives authenticated identity only through Sites before enabling the gallery there.
- No OpenAI API key, model, or billable AI service is used. ChatGPT sign-in supplies adult identity only when the gallery is hosted on Sites. Keep any future optional provider credentials server-side.

### Retention and pilot gate

The pilot caps classes at 24 hours, QR invites and memberships at two hours, active sessions at 48 per invite, ongoing submissions at two per membership and 12 per class, and stored drawings at 24 per class across four classes. The generated PNGs are 192 × 132 pixels and capped at 16 KiB. Invite rotation and revocation invalidate sessions immediately on their next request. Reported drawings become unavailable to the class immediately. Adult removal deletes the metadata and private object.

Expired items stop being readable at their deadline. The Worker includes cleanup for expired records, abandoned writes, and orphaned objects, available through the adult **Clear expired samples** control and a scheduled handler. Before hosted enablement, verify a supported unattended trigger and private R2 expiry policy on the exact deployment, and confirm deletion behavior for storage and backups. A handler alone does not schedule it.

Before a real pilot, obtain school and caregiver approval and verify retention and deletion. A future plan can start with local crop and preview, local face/photo/text risk checks, and retake or optional local adult help when a result is uncertain. The server must independently decide whether artwork is drawing-only and age-appropriate before it persists or appears in the gallery. Rejected or uncertain files must not be stored, shared, or sent for generation. Class adults manage access, reports and removals. Local animation remains the default plan. Evaluate any optional bring-your-own provider only on approved synthetic or adult fixtures before considering it for use. The [optional intelligence plan](INTELLIGENCE.md) describes how to evaluate a provider. This build has no provider integration, model, or credentials.

## Print public game QR cards

The local generator makes one US Letter sheet with nine Pencil Pal cards. The default QR opens directly to Little fox. Sample class invites use separate QR codes managed from the classroom controls.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-qr.txt
.venv/bin/python scripts/generate_qr_cards.py --output little-pencil-club-qr-cards.pdf
```

For a fork, pass its public game URL using `--url`. Print at actual size (100%) and cut along the dotted lines.
