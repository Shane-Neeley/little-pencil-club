# Deployment and configuration

## Public game

The published [Little Pencil Club Site](https://little-pencil-club.fort-rock.chatgpt.site/) serves the static game from `dist/`. A local file server can serve the same directory. The game uses no account, API, database, or model. Sketchbook progress and strokes stay in that browser. Export a PNG to keep a separate copy.

## Synthetic classroom preview

The gallery is a draft available for local testing. From the checkout, with Node.js 22 or newer:

```sh
npm ci
npm test
npm run dev
```

Open [the local classroom](http://127.0.0.1:8787/classroom). The server binds to loopback and uses simulated D1 and R2 in the ignored `.classroom-preview/` directory. It accepts server-generated samples only. `npm run build` writes the Worker to `.classroom-build/dist/server/index.js`, outside the public game's static files.

For adult controls, pass a random `CLASSROOM_PREVIEW_OWNER_KEY` of at least 32 characters in the preview process environment. Open [Class controls](http://127.0.0.1:8787/classroom/review), choose **Sign in to manage a class**, and use username `adult` and the local key. Create a sample class and open its QR in two separate browser profiles. Share a sample, try the uncertain screening result, **Report** a drawing as a member, and **Remove** it in adult controls. To reset the local test data, stop the preview and remove `.classroom-preview/`.

## Separate owner-private hosted verification

This is a future verification path. The public Site uses its existing static hosting manifest. Keep the test Site, its source, and its storage separate from the public project.

| Prerequisite | Documented support and verification status |
| --- | --- |
| Owner-private publication | ChatGPT Sites supports private publication and provides an owner-only deployment operation. A future test project needs its own project ID and confirmed owner-only access. Check any workspace-admin exceptions before relying on the boundary. [ChatGPT Sites help](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites) |
| Verified hosted identity | Sites documents dispatch-provided, Site-scoped `oai-authenticated-user-id` for signed-in visitors. The draft matches that ID against the configured adult and class owner. The local fixture does not verify hosted header handling. |
| Dedicated D1 and R2 | Sites documents provisioning `d1` and `r2` from a Worker manifest. `DB` holds class, invite, session and artwork metadata. `BUCKET` holds generated PNG bytes. Both bindings and independent persistence passed in the local simulator. Verify the hosted resources are dedicated to the test project and that the bucket has no public access or public object URLs. [Sites developer guide](https://learn.chatgpt.com/docs/sites) · [R2 bucket access](https://developers.cloudflare.com/r2/buckets/create-buckets/) |
| Unattended expiration | Sites supports linked cloud schedules for a published Site when enabled for the account. Each run needs verified access to its cleanup writer without an open browser. The draft's adult cleanup route requires a browser role and same-origin request. The Worker also exports a scheduled handler. Sites support for wiring Cloudflare Cron to that handler is unverified. [Sites schedules](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites) · [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) |

For a later authorized test:

1. Register a separate Site and confirm owner-only access before using the private deployment operation. In a separate checkout, use the test Site's returned project ID in its hosting manifest. Omit static hosting there and declare `d1: DB` and `r2: BUCKET`. Stage the verified Worker as `dist/server/index.js` and copy `classroom/drizzle/` to the test checkout's root `drizzle/` for packaging. Tie the archive to the exact test source commit using the Sites source helper. The gallery switch starts off.
2. With synthetic mode off, use a temporary owner-only server check on the private test build to verify platform identity. Check that signed-out requests are denied and that an untrusted caller-supplied identity header cannot replace the signed-in owner's Site identity. Set `CLASSROOM_ADMIN_USER_ID` to the authenticated Site-scoped ID through the test Site environment only. Set `CLASSROOM_SYNTHETIC_ENABLED=1` only for the approved test. Apply the settings to the exact test source and recheck authorization on the resulting deployment before writing fixtures. The server accepts preset samples in every enabled configuration. Keep identifiers and credentials out of source and logs.
3. In two isolated browser profiles signed in as the owner, create distinct classroom sessions with synthetic fixtures and test direct image access with and without membership, cross-class denial, and revocation. Use an owner-only temporary check to confirm the D1 row and R2 bytes independently through their bindings. Verify that removal deletes both, including when checked from a fresh request. Keep object keys, invite links, and images out of the verification report.
4. Choose the trigger before seeding fixtures. The documented Sites option is a linked cloud schedule calling a narrowly scoped cleanup writer on the dedicated private Site. That writer and fresh-task authorization still need implementation and validation. Sites service access, when provided, is separate from browser identity and must be available to the scheduled run without secrets in its prompt. Alternatively, use the Worker handler only if Sites documents a supported Cron binding for this project. Demonstrate an actual unattended run after a synthetic expiry and independently confirm neither D1 rows nor R2 objects remain. An R2 lifecycle rule, if configurable on the managed bucket, can provide an object-only backstop and may delete after the deadline. [R2 lifecycle timing](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
5. Record the tested version and results, clear the synthetic data, remove temporary verification routes, disable the feature switch, and retire the private test and its trigger as agreed. Keep the prototype local if owner-only access, resource isolation, or unattended cleanup cannot be verified.

A separate Site and storage, authorization to create them, a supported cleanup writer with unattended access, and an accepted expiry and teardown window remain future decisions. No alternate storage provider adapter or D1 blob fallback is implemented.

## Retention and real classroom gate

The synthetic gallery caps classes at 24 hours, QR invites and memberships at two hours, ongoing submissions at two per member and 12 per class, and stored drawings at 24 per class across four classes. A class invite admits up to 48 active sessions. Generated PNGs are 192 × 132 pixels and capped at 16 KiB. Expired or revoked sessions are denied on their next request. Reports hide drawings for class members. Adult removal deletes the metadata and private object. Local **Clear expired samples** invokes the cleanup code.

Real enrollment and photo uploads are unavailable. A real pilot would require school and caregiver approval, verified retention and deletion, and a validated server-side drawing-only and age-appropriate screening policy that rejects uncertain input before persistence. The [optional intelligence plan](INTELLIGENCE.md) describes a possible later provider evaluation. No API key, model, or billable AI service is used by the game or gallery draft.
