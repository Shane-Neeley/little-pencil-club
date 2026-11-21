# Drawing Decisions prototype

This optional server-side adapter has no installed transport and starts disabled. The camera prototype, lessons, Sites builds, and classroom Worker do not import it.

## Run offline

```sh
node --test prototypes/drawing-decisions/decisions.test.mjs
node prototypes/drawing-decisions/benchmark.mjs --mock
```

Run the benchmark without arguments to check the disabled path. The CLI rejects other flags. Its fixture images are generated in memory. Mock results exercise routing and scoring without measuring a model.

## Contract and data boundary

The adapter builds the documented `POST /v1/decisions` choice request for `gpt-6-luna`. It supplies one inline PNG and accepts the result enums `allow` and `retake`. It disables implicit prompt caching using explicit cache mode with no breakpoints. This setting governs prompt reuse. Project retention eligibility must be verified separately. [Decisions guide](https://developers.openai.com/api/docs/guides/decisions) · [Create decision reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)

An approved future host must provide a server-side crop, decode, local privacy check, and metadata-stripping PNG re-encode. The adapter checks the PNG header, a 1 MiB limit, and a 1024-pixel limit per side. The classifier permits only an explicit, internally consistent high-confidence `allow`. The provisional thresholds are 0.95 for the allow probability and 0.85 for provider confidence. A disabled switch, rejected local step, malformed result, refusal, provider failure, or deadline closes the path before the approved callback. The host owns the transaction for approved persistence and access control. Generating any derivative needs separate authorization and output controls.

The fixture labels cover a drawn face, a drawn leaf, two synthetic adult portrait cases, fictitious identifying writing, a non-drawing, a low-visibility drawing, and a harmless stand-in for an inappropriate image. The stand-in exercises expected retake routing and cannot validate detection of inappropriate content. The benchmark separates safe false retakes, blocked false approvals, high-risk false approvals, and stand-in false approvals. It sends at most one request per fixed fixture, stops on the first infrastructure failure, and reports only aggregate outcomes and bounded reason enums.

## Before any live test or integration

- For a synthetic-only live benchmark, use a separate approved local runner with a credential delivered through the existing secret mechanism for its selected API project. Verify a fresh positive credit grant or scoped reservation, reconcile other callers, reserve against current pricing, and enforce a hard cap of 20 requests with retries off. Record actual usage or unknown outcomes privately and keep only aggregate/redacted benchmark results. This prototype deliberately ships no live network client.
- Benchmark only generated synthetic or separately approved adult-owned fixtures. Expand coverage to realistic capture quality, identifying details, mixed media and prompt instructions embedded in images. Review per-class false approvals separately and treat a high-risk miss as a blocker. A small benchmark cannot establish production safety.
- Keep real enrollment, uploads and generation disabled until a suitable host, school and caregiver authorization, a tested local privacy check, an independently verified policy, and retention and deletion controls are in place. Verify endpoint and project eligibility for Zero Data Retention before processing personal data of children below the applicable age. [Under-18 API guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) · [API data controls](https://developers.openai.com/api/docs/guides/your-data)
