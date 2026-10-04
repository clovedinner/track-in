# Test Strategy

This document turns the testing requirements in `AGENTS.md` into an implementation plan. It applies to Phase 0 through Phase 2 and deliberately excludes dashboard visual coverage until the dashboard exists.

## Recommended stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| Unit and route/use-case tests | Vitest | Fast TypeScript tests, spies, fake timers, and coverage. |
| PostgreSQL integration tests | Vitest + Testcontainers for Node.js | Run each suite against a real, disposable PostgreSQL instance; exercise migrations and constraints rather than mocking database behavior. |
| Browser end-to-end tests | Playwright | Verify redirects, private-route authentication, and the complete click-to-conversion HTTP flow. |
| External HTTP mocking | MSW (Node) or a small local HTTP test server | Verify provider request formatting and classified responses without contacting an ad platform. |
| Test fixtures | TypeScript factory functions | Build only explicit, minimal campaigns, clicks, conversions, and provider responses. |

The project may provide a local PostgreSQL container for development separately. Integration tests must use a database selected by `TEST_DATABASE_URL`, never the normal development or production URL. Testcontainers is preferred for CI and isolated local runs; it requires a Docker-compatible runtime. If that runtime is unavailable, the integration suite must fail clearly or use a separately provisioned disposable database identified by `TEST_DATABASE_URL`; it must never fall back to another environment.

## Test environment boundaries

Use separate environment files and variables with safe placeholders only:

| Context | Database variable | Secrets | External network |
| --- | --- | --- | --- |
| Local development | `DATABASE_URL` | local-only values | disabled by default for tests |
| Unit tests | none, unless a module explicitly needs configuration | deterministic test values | no database or provider calls |
| Integration tests | `TEST_DATABASE_URL` set by Testcontainers or an explicitly created disposable database | deterministic test values | no real provider calls |
| End-to-end tests | a dedicated test database and test app configuration | deterministic operator and money-site secrets | provider calls intercepted locally |
| Production | `DATABASE_URL` only | managed/deployment secrets | real, explicitly enabled destinations only |

Rules:

- Test configuration must reject a database URL that matches the normal `DATABASE_URL` value.
- Tests must use reserved example destinations such as `https://money-site.test/...`; no fixture may contain production domains, credentials, customer IDs, click IDs, IP addresses, or personal data.
- CI must supply only test secrets and a disposable database. Never copy a developer or production `.env` file into a test job.
- Use one predictable clock in tests. Pass time into domain services or use fake timers; assert all stored timestamps as UTC.
- Create data per test and clean it through transaction rollback, schema reset, or container disposal. Suites must tolerate parallel execution without shared IDs.
- Disable real outbound provider traffic in every automated test. A test attempting it is a failure.

## Test layers and responsibilities

### Unit tests

Test pure domain logic and provider request construction without Next.js runtime or PostgreSQL.

Required initial cases:

- Click ID generator produces opaque, URL-safe, cryptographically generated identifiers; identifiers are not derived from campaign IDs or time.
- Tracking parameter allowlist drops unknown keys, rejects bounded-invalid input, and preserves only configured provider tokens.
- Redirect builder appends exactly one configured `cid`, preserves only approved destination parameters, and cannot use a request-supplied destination.
- Conversion schema accepts the documented valid shape and rejects missing fields, invalid currencies, malformed timestamps, invalid money ranges, and oversized input.
- Authentication verifier rejects missing/incorrect secrets and accepts the defined test signature or bearer secret using a safe comparison implementation.
- Error formatter produces the documented HTTP status and stable machine-readable error code without secret-bearing details.
- Metrics formulas handle normal values, zero clicks, missing cost, and zero cost correctly.
- Provider adapters build the required payload from allowed click tokens, use an event/transaction ID when supported, and classify success, retryable failure, and permanent failure.
- Retry policy calculates bounded exponential backoff with jitter deterministically when its random source is injected.

### PostgreSQL integration tests

Apply real migrations to an empty disposable database before the suite. Test database constraints and transactions through the application data layer, not only through mocked repositories.

Required Phase 0/1 cases:

- The initial migration creates all expected tables, indexes, foreign keys, enum/check constraints, and uniqueness rules.
- A valid click stores its campaign relationship and opaque click ID; duplicate click IDs violate the database unique constraint.
- A valid conversion for an existing click commits its conversion and exactly one eligible outbound-postback row atomically.
- Replaying the same money-site `event_id` returns the existing result and creates neither another conversion nor another outbound postback.
- An unknown click ID leaves no conversion or outbound-postback row.
- A failed outbox insert rolls back the conversion insert, and a failed conversion insert leaves no outbox row.
- The outbound uniqueness rule prevents duplicate delivery jobs for the same conversion and destination.
- State transitions for `pending`, `processing`, `delivered`, `retryable_failed`, `permanently_failed`, and `suppressed` enforce the selected transition rules once implemented.

Required Phase 2 cases:

- A worker claims a due job without allowing a second worker to process the same job.
- A transient provider response records a sanitized failure and a future retry timestamp.
- A permanent provider response becomes terminal and is not scheduled again.
- A success response records delivery once; rerunning the worker does not report the conversion again.

### HTTP and contract tests

Exercise route handlers with real request objects and the isolated database. Keep money-site and provider examples as versioned JSON fixtures under the test directory.

- `GET /t/{campaign-slug}`: active campaign returns the selected redirect status and destination containing `cid`; unknown/inactive campaign returns `404`; malformed or unallowed parameters do not leak into the destination.
- `POST /api/conversions`: unauthenticated, invalid, oversized, and unknown-click requests return the documented safe error code; a valid request returns `accepted`; replay returns `duplicate` and its original conversion ID.
- Provider contract tests assert method, endpoint path, headers after redaction, body, token mapping, event identifier, and response classification against a local intercept.
- Log-capture tests assert that authorization headers, money-site secrets, and raw sensitive query values do not appear in structured log fields or error messages.

### End-to-end tests

Run the built application against a dedicated test database with a test-only money-site secret. Mock the chosen provider at the network boundary.

Minimum Phase 1 scenario:

1. Create or seed an active campaign with an approved `.test` destination.
2. Request its tracking URL with allowlisted platform tokens.
3. Capture the redirect and its `cid`.
4. Send an authenticated conversion using that `cid`.
5. Confirm the accepted response, exactly one stored conversion, one durable outbound job, and campaign attribution.
6. Replay the same conversion and confirm the `duplicate` response and unchanged row counts.

Minimum Phase 2 scenarios:

- A transient mocked provider failure produces a retryable job, then a mocked success marks it delivered exactly once.
- A permanent mocked provider failure becomes visible as permanently failed and stops retrying.

## Fixtures, factories, and mocks

- Keep factories close to tests and require callers to provide identities that matter to the assertion. Do not hide event IDs or click IDs behind random defaults when testing idempotency.
- Use fixed test secrets such as `test-money-site-secret`; they must be clearly non-production and never logged.
- Provider mocks must represent the provider's documented test responses when an adapter is added. Store sanitized request/response examples only.
- Seed data is allowed only for repeatable developer demos and end-to-end setup. It must be resettable and must not become a production bootstrap dependency.
- Use generated unique values with a test-run prefix to prevent collisions, while assertions remain deterministic.

## Quality gates to wire into package scripts and CI

These are the required commands once the project is bootstrapped. Names may remain as written unless a concrete tooling constraint requires a documented change.

```text
npm run lint             # ESLint: no warnings
npm run typecheck        # tsc --noEmit: no errors
npm run test:unit        # Vitest unit/HTTP-contract suite
npm run test:integration # migrations + PostgreSQL integration suite
npm run test:e2e         # Playwright end-to-end suite
npm run test             # runs unit, integration, and e2e suites in a safe sequence
npm run build            # production Next.js build
npm run check            # lint + typecheck + test + build
```

Required gate behavior:

- `check` exits non-zero for any lint, type, test, migration, or build failure.
- Integration and end-to-end commands refuse to run without an isolated test database configuration.
- The integration command applies migrations to a fresh database before tests; it must not rely on schema synchronization.
- The end-to-end command starts the application with test-only configuration and prevents outbound provider traffic.
- CI runs `npm ci` (or the package manager's locked equivalent) followed by `npm run check` from a clean checkout.
- A pull request cannot merge with a failing `check` job. Coverage thresholds may be added after baseline coverage is measured; do not invent a percentage gate now.

## Implementation order

1. During Phase 0, install Vitest, Playwright, Testcontainers, and the selected HTTP mocking tool; add the scripts above and a smoke test for each runner.
2. Add the test environment loader and database safety guard before any database-dependent test.
3. Add migration smoke coverage when the data layer and first migration exist.
4. Add unit and integration coverage alongside each Phase 1 behavior; no redirect, conversion, or idempotency feature is complete without its listed test.
5. Add the provider mock, adapter contract tests, and worker integration tests with the first Phase 2 adapter.

## Explicit exclusions for now

- No browser tests for dashboards that do not exist.
- No real ad-platform credentials, sandbox accounts, or production endpoints in automated tests.
- No load, penetration, or visual-regression test program until the corresponding product surface and operational need exist.
- No percentage coverage target until a meaningful baseline exists; the behavior-based quality gates above are mandatory from the start.
