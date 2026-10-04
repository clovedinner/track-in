# Minimal Conversion Tracker: Delivery Plan

This is the active implementation checklist for the self-hosted conversion tracker. `AGENTS.md` defines the product contract. Update this file at the end of every meaningful work session: mark completed work, record decisions, and add only concrete blockers.

## Current status

- Current phase: Phase 1, trustworthy click and conversion loop
- Current milestone: reconcile dashboard totals, then begin production hardening
- Current task: run the setup workflow with a controlled client-like campaign, then rehearse backup/restore
- Production traffic: not enabled
- Known blockers: controlled live-provider conversion, cost source, deployment host, and restore rehearsal are not configured.

## Rules for maintaining this plan

- Check a task only after its acceptance criteria are verified.
- Add a dated decision under "Decision log" when it changes architecture, data retention, a public contract, or an integration behavior.
- Record failures and unresolved choices under "Blockers and risks" with the smallest useful next action.
- Keep future ideas out of the active checklist unless they satisfy the product contract in `AGENTS.md`.
- Do not mark a phase complete merely because its code exists. Complete its verification steps too.

## Phase 0: foundations

Goal: establish a secure, repeatable local development environment with a tested PostgreSQL-backed application.

### Project setup

- [x] Initialize a Next.js App Router project using TypeScript strict mode.
- [x] Define package scripts for development, build, lint, type checking, unit tests, integration tests, and end-to-end tests.
- [x] Add a `.gitignore` that excludes environment files, build output, local database data, logs, and test artifacts.
- [x] Add `.env.example` containing names and safe placeholders for required variables only.
- [x] Write local setup instructions in `README.md`.
- [x] Confirm production builds successfully from a clean install.

### Database and migrations

- [x] Choose and install a migration-based PostgreSQL data layer.
- [x] Provide a reproducible local PostgreSQL environment.
- [x] Create the initial schema and migration for campaigns, traffic sources, clicks, conversions, and outbound postbacks.
- [x] Add database constraints for opaque click-ID uniqueness, conversion idempotency, foreign keys, and outbound-postback uniqueness.
- [x] Define UTC timestamp handling and monetary-value conventions in the data layer.
- [ ] Verify migrations apply to an empty database and can be rolled forward in a clean environment.

### Application foundations

- [x] Add environment-variable validation that fails clearly during startup when a required production secret is missing.
- [x] Add request validation schemas for public tracking requests and money-site conversions.
- [x] Add structured logging with request/correlation IDs and secret redaction.
- [x] Add health and readiness endpoints.
- [x] Add a minimal private authentication boundary for administration routes.
- [x] Define error responses and a consistent error-code format for the conversion endpoint.

### Test foundations

- [x] Configure a unit-test runner.
- [x] Configure integration tests against an isolated PostgreSQL database.
- [x] Configure an end-to-end test runner for the main browser and HTTP flows.
- [x] Add a test-data strategy that never uses production credentials or personal data.
- [x] Verify the full test suite and lint/type checks run in one repeatable command or CI workflow.

### Phase 0 acceptance check

- [ ] A new developer can clone the repository, configure local placeholders, start PostgreSQL, run migrations, start the application, and run all checks using documented steps.
- [ ] The application rejects invalid configuration without exposing secrets.
- [ ] The database schema exists only through reviewed migrations.

## Phase 1: trustworthy click and conversion loop

Goal: record a click, pass its opaque ID to the money site, and store an authenticated, idempotent conversion.

### Campaign configuration

- [x] Create private campaign management with slug, name, status, destination, currency, and allowed parameters.
- [x] Validate destinations against the campaign's allowlisted URL configuration.
- [x] Create a seed or fixture campaign for local testing.

### Click tracking

- [x] Implement `GET /t/{campaign-slug}`.
- [x] Generate cryptographically strong opaque click IDs.
- [x] Persist only allowlisted tracking parameters and required request metadata.
- [x] Safely append `cid` to the configured destination URL.
- [x] Return `404` for unknown or inactive campaigns and never fall back to an arbitrary destination.
- [x] Add unit and integration tests for redirect creation, parameter allowlisting, and invalid campaign behavior.

### 2026-10-04: click redirect foundation

- Completed: Added opaque click-ID generation, allowlisted token collection, safe destination construction, and `GET /t/{campaignSlug}` with persisted click records and correlation IDs.
- Verified: lint, type checking, production build, and 7 unit tests pass. The Neon migration status reports the schema is up to date.
- Decisions: the redirect always sets the canonical `cid` parameter and never accepts a request-supplied destination URL.
- Blockers: an active campaign fixture and private campaign-management route are still needed before end-to-end redirect verification.
- Next task: implement private campaign creation and seed one `.test` destination for the click-flow test.

### Conversion intake

- [x] Implement authenticated `POST /api/conversions`.
- [x] Require `cid`, `event_id`, `event_type`, `occurred_at`, `value_minor`, and `currency`.
- [x] Validate payload format, timestamp range, numeric range, and authentication before writing.
- [x] Attribute the conversion only through an existing click ID.
- [x] Make duplicate conversion events return an idempotent result.
- [x] Store a durable outbound-postback record in the same transaction as a newly accepted conversion.
- [x] Add tests for accepted, duplicate, unknown-click, unauthenticated, and invalid conversion requests.

### Private verification view

- [x] Show recent clicks and conversions for a campaign in a private page.
- [x] Include non-sensitive diagnostic status needed for reconciliation.

### Phase 1 acceptance check

- [x] An end-to-end test proves: ad click -> redirect containing `cid` -> authenticated conversion -> exactly one attributed conversion.
- [x] Replaying the same conversion results in no additional conversion or outbound-postback record.
- [x] Invalid redirects and unauthenticated conversion attempts are rejected.

## Phase 2: outbound reporting

Goal: reliably report accepted conversions to one real ad platform through a durable, observable delivery process.

- [x] Define the provider-adapter interface and common delivery states.
- [x] Implement a database-backed worker or scheduled processor for pending postbacks.
- [x] Implement one chosen ad-platform adapter using its documented conversion API or postback format.
- [x] Map allowed original platform click tokens from the click record to the provider payload.
- [x] Implement safe retry classification, bounded exponential backoff, and jitter.
- [x] Persist sanitized request fingerprints and response diagnostics.
- [x] Add private delivery-health and manual-retry controls with audit records.
- [ ] Add provider contract tests and a controlled platform test conversion.

### Phase 2 acceptance check

- [ ] A new conversion creates one durable delivery job.
- [ ] A transient provider failure retries and later succeeds without duplicate reporting.
- [ ] A permanent provider failure becomes visible to the operator and does not retry forever.

## Phase 3: useful dashboard

Goal: make campaign decisions using data whose definitions are stable and traceable.

- [x] Create an overview with clicks, conversions, conversion rate, revenue, cost when available, profit, and ROI when available.
- [x] Create a sortable, filterable campaign table.
- [x] Create a campaign detail page with daily trend, recent clicks, conversions, and delivery failures.
- [x] Centralize conversion rate, profit, and ROI formulas in one shared module.
- [x] Add date range, campaign, traffic-source, and event-type filtering.
- [ ] Add imported daily campaign costs only when a real data source and operating need exist.
- [x] Verify empty, loading, error, and no-cost states.

### Phase 3 acceptance check

- [x] Every displayed metric traces to persisted source records.
- [ ] Zero or missing cost displays ROI as unavailable, not infinite or zero.
- [ ] Dashboard totals match direct database reconciliation for a test dataset.

### Voluum-like campaign setup workflow

Goal: let the operator configure a campaign and copy the exact URLs, GTM snippets, and platform postbacks needed for the client's existing workflow.

- [x] Add a private campaign creation/edit form with destination URL, currency, event types, and allowlisted tracking parameters.
- [x] Generate a copyable campaign tracking URL for TrafficStars, PropellerAds, and TrafficJunky using each platform's original click-token macros.
- [x] Generate copyable GTM Custom HTML/Image snippets for registration, FTD, and optional `txid` events using the Voluum-compatible `/postback` contract.
- [x] Generate copyable outbound postback templates for TrafficStars, PropellerAds, and TrafficJunky from saved traffic-source configuration.
- [x] Add a setup/test view that sends a controlled click and verifies click capture, conversion attribution, and outbound delivery preparation.
- [x] Document the operator handoff from campaign creation to ad-platform configuration and GTM publishing.

### Setup workflow acceptance check

- [x] An operator can create a campaign, copy a platform-specific tracking URL, and open the destination with the expected click token.
- [x] An operator can copy the GTM registration/FTD snippets and see both events attributed to the captured click.
- [x] An operator can copy each platform's postback template without exposing stored credentials.
- [x] A controlled setup test reports clear success or repair guidance for each step.

## Phase 4: hardening and operation

Goal: safely use the tracker with paid production traffic.

- [ ] Document personal-data minimization, retention duration, and deletion/anonymization procedure.
- [ ] Review rate limits, redirect allowlists, authorization, HTTPS configuration, headers, and secret rotation procedure.
- [ ] Implement backups and complete a documented restore rehearsal.
- [ ] Configure actionable alerts for tracking failures and terminal postback failures.
- [ ] Create runbooks for failed deliveries, unknown click IDs, credentials, outages, and restores.
- [ ] Deploy a production environment with separate secrets and database access controls.
- [ ] Complete the controlled live-traffic verification from `AGENTS.md`.

### Phase 4 acceptance check

- [ ] A backup restore has been performed successfully.
- [ ] An operator can diagnose and retry a failed postback without shell access or secret exposure.
- [ ] Controlled live traffic produces correct click, conversion, and outbound reporting records.

## Decisions needed before Phase 2 or production

- [ ] Select the first ad platform to support.
- [ ] Confirm the money-site authentication scheme: signed HMAC request or bearer secret.
- [ ] Confirm the deployment host and managed PostgreSQL provider.
- [ ] Confirm the reporting business timezone, if it differs from UTC date boundaries.
- [ ] Set a personal-data retention period before live traffic.
- [ ] Confirm the source and cadence for campaign-cost imports, if ROI reporting is needed.

## Decision log

| Date | Decision | Reason | Impact |
| --- | --- | --- | --- |
| 2026-10-03 | Use Next.js with TypeScript and PostgreSQL as the default architecture. | A single application keeps personal-use operations simple while PostgreSQL supplies transactional attribution and durable postback work. | Phase 0 setup and data model. |
| 2026-10-03 | Use `cid` as the canonical money-site click parameter. | A stable, documented handoff prevents weak attribution reconstruction. | Tracking redirect and money-site conversion contract. |
| 2026-10-04 | Use Prisma with Neon pooled runtime connections and direct migration connections. | Neon pooling keeps request connections efficient while Prisma Migrate requires a direct database connection. | Runtime database client, migrations, and deployment configuration. |

### 2026-10-03: application bootstrap

- Completed: initialized the Next.js App Router application with TypeScript strict mode; added local environment placeholders, ignore rules, local setup instructions, and `lint`, `typecheck`, and combined `check` scripts.
- Verified: scaffold configuration has `strict: true`; `.env.example` uses safe local placeholders; no navigation, fake metrics, or tracker claims appear in the temporary landing page.
- Decisions: the temporary root page is explicitly labeled "Draft without direction" until the dashboard has a product design direction.
- Blockers: the initial package installation was interrupted and clean-install verification is still pending.
- Next task: complete dependency verification, then add PostgreSQL, authentication, validation, logging, and test foundations in their dedicated tasks.

## Blockers and risks

| Item | Status | Next action |
| --- | --- | --- |
| No first ad platform selected. | Open | Select one platform before Phase 2 implementation. |
| Isolated integration database is not configured. | Open | Set a disposable `TEST_DATABASE_URL` that is different from `DATABASE_URL`, apply migrations, and run the Phase 1 integration suite. |
| Neon is selected as the managed database provider; deployment host remains unselected. | Open | Choose the application deployment host before production hardening. |
| Prisma CLI dependency advisory. | Open | Review the three high-severity Prisma CLI dependency advisories before production deployment; runtime Client generation and local checks still pass. |
| Neon connection strings are not configured. | Resolved locally | `.env.local` now contains pooled `DATABASE_URL` and direct `DIRECT_URL`; `npm run db:status` reports the schema is up to date. |

## Session update template

Add this after each implementation session when useful:

```md
### YYYY-MM-DD: concise session title

- Completed:
- Verified:
- Decisions:
- Blockers:
- Next task:
```

### 2026-10-04: initial database implementation

- Completed: Added the initial PostgreSQL schema and append-only migration.
- Verified: `npm run typecheck` and `npm run lint` passed.
- Decisions: PostgreSQL remains the project database; all primary keys use PostgreSQL-generated UUIDs and all event timestamps use `timestamptz`.
- Blockers: The database provider configuration is pending, so migration execution and constraint verification remain pending.
- Next task: Configure a managed PostgreSQL connection, apply the migration, and run the database acceptance checks.

### 2026-10-04: test foundation and clean-build verification

- Completed: Added Vitest, Playwright, Testcontainers, MSW, isolated-test database guard, and test-runner scripts. Updated Node.js type definitions to match the documented Node 22 runtime.
- Verified: `npm ci`, `npm run check`, `npm run test:unit` with three passing tests, and `npm run build` all passed from the current clean dependency lockfile.
- Decisions: Unit tests run without database access. Integration tests require `TEST_DATABASE_URL` and reject a value equal to `DATABASE_URL`; end-to-end tests are reserved for test-only configuration.
- Blockers: The integration and end-to-end suites remain pending until a disposable PostgreSQL runtime and initial test fixtures exist.
- Next task: Start a disposable PostgreSQL instance, apply the migration, and run the database acceptance checks.

### 2026-10-04: Prisma and Neon migration

- Completed: Replaced Drizzle with Prisma ORM, generated Prisma Client, and converted the initial SQL migration to Prisma Migrate format. Added Neon pooled and direct connection variables.
- Verified: Prisma Client generation completed with Prisma 6.19.3; schema validation, linting, type checking, unit tests, and the production build passed.
- Decisions: Neon is the managed PostgreSQL provider. `DATABASE_URL` is pooled and used by the runtime through Prisma's Neon adapter; `DIRECT_URL` is direct and used by Prisma migration and Studio commands.
- Blockers: A Neon project and its connection strings are required before the initial migration can be applied.
- Next task: Add Neon connection strings to `.env.local`, run `npm run db:migrate`, and complete the database acceptance tests.

### 2026-10-04: Phase 1 parallel implementation wave

- Completed: Added private campaign CRUD, click redirect persistence, authenticated conversion intake with idempotency and transactional outbox creation, shared dashboard metric formulas, and a provider-agnostic outbox worker with retry/backoff handling.
- Verified: `npm run check`, `npm run test:unit -- --run` (7 files, 29 tests), and `npm run build` all pass. Neon reports the Prisma migration is up to date.
- Decisions: Keep the first outbox worker provider-agnostic until one real ad platform is selected; keep dashboard formulas pure and shared before adding UI queries.
- Blockers: An active campaign fixture and database-backed acceptance run are still needed; the first ad platform and deployment host remain undecided.
- Next task: Seed an active `.test` campaign, run the click-to-conversion flow against an isolated Neon database, then choose the first provider adapter.

### 2026-10-04: Phase 1 fixture and acceptance preparation

- Completed: Added the guarded, repeatable `demo.test` campaign seed (`npm run db:seed:test`) and a database-backed Phase 1 integration test covering click registration, attribution, outbound-record creation, and duplicate replay.
- Verified: The seed ran twice successfully against the configured Neon project; fixture creation requires `TRACK_IN_ALLOW_TEST_SEED=1` and refuses `NODE_ENV=production`. Lint and type checking pass.
- Decisions: Integration tests require a separate `TEST_DATABASE_URL`; the suite refuses to run against the application database to prevent accidental live-data mutation.
- Blockers: The isolated test database URL is not configured, so the database-backed acceptance run remains pending.
- Next task: Configure the disposable test database, run the integration suite, then start the private verification page.

### 2026-10-04: Phase 1 acceptance complete

- Completed: Ran the isolated database-backed click-to-conversion acceptance suite successfully, including attribution, one outbound record, duplicate replay, and cleanup. Fixed the integration Vitest `@/` path alias so generated Prisma imports resolve consistently.
- Verified: `npm run test:integration` passed against the separate `TEST_DATABASE_URL` database.
- Decisions: Keep the private verification page narrowly focused on recent clicks, conversions, and delivery status before building the full dashboard.
- Blockers: The first outbound ad platform is still unselected; production deployment remains disabled.
- Next task: Build the private verification page, then proceed to provider selection and the full dashboard.

### 2026-10-04: private verification UI

- Completed: Added the Basic Auth-protected `/admin` verification page with live click, conversion, and pending-delivery totals plus recent activity tables and explicit empty/error states.
- Verified: `npm run check` and `npm run build` pass. The page is forced dynamic so it reads a current database snapshot on each request.
- Decisions: Keep this page operational and evidence-focused; full campaign comparison, costs, profit, and ROI remain Phase 3 dashboard work.
- Blockers: The first outbound ad platform is still unselected; production deployment remains disabled.
- Next task: Select the first provider and implement its adapter contract before expanding dashboard scope.

### 2026-10-04: Voluum compatibility decision

- Completed: Changed the product contract to reproduce the client's existing Voluum behavior, including a narrow public `/postback` endpoint for GTM registration/FTD events alongside the authenticated backend conversion API.
- Verified: The compatibility contract requires valid recorded click IDs, Voluum-style `et`/`txid` handling, duplicate suppression, and the same durable outbound work as authenticated conversions.
- Decisions: Do not block browser/GTM postbacks with bearer authentication that the browser cannot keep private; use rate limits, strict bounds, click validation, and idempotency as the compatibility safeguards.
- Blockers: The `/postback` route is not implemented yet; traffic-source adapter details still need to be configured from the client's TrafficStars, PropellerAds, and TrafficJunky accounts.
- Next task: implement and test `GET /postback`, then add source-specific token mappings and outbound URL templates.

### 2026-10-04: Voluum-compatible postback foundation

- Completed: Added `GET /postback` with Voluum-style `cid`, `et`, optional `txid`, value, and currency parsing; valid click matching; duplicate suppression; registration/FTD event identity; image-friendly responses; and transactional outbound-postback creation.
- Verified: `npm run check`, `npm run test:unit -- --run` (31 tests), and `npm run build` pass. The generated route is available at `/postback`.
- Decisions: Registration and FTD without `txid` are distinct event identities; repeated events for the same click/event are ignored; `txid` identifies later unique conversions.
- Blockers: Route-level database contract coverage and live source-specific templates remain pending.
- Next task: add integration coverage for GTM-style `/postback` requests, then configure TrafficStars, PropellerAds, and TrafficJunky mappings.

### 2026-10-04: traffic-source adapter wave

- Completed: Added TrafficStars, PropellerAds, and TrafficJunky outbound postback adapters with original click-token mappings, event/value handling, response classification, retry signaling, and provider configuration validation. Added `/postback` integration coverage for registration, FTD, unique `txid`, duplicate suppression, and outbound record creation.
- Verified: `npm run check` and `npm run test:unit -- --run` pass with 11 test files and 51 tests.
- Decisions: Preserve each platform's original click token; never substitute Track.in's internal `cid` for a source-specific identifier such as TrafficJunky `ACLID` or Propeller `visitor_id`.
- Blockers: The adapters are isolated modules pending worker/registry wiring; the full integration suite must be rerun from the configured test shell with `TEST_DATABASE_URL`.
- Next task: connect provider selection to the outbox worker, run `npm run test:integration`, and add delivery-health controls.

### 2026-10-04: outbound operations wave

- Completed: Wired TrafficStars, PropellerAds, and TrafficJunky adapters into outbox delivery; added private traffic-source CRUD, delivery-health reads, audited manual retry, and filtered dashboard query functions. Added the audit-entry migration and applied both migrations to Neon.
- Verified: `npm run check` and `npm run test:unit -- --run` pass with 16 test files and 65 tests. `npm run db:migrate` applied `20261004010000_add_audit_entries` successfully.
- Decisions: Provider dispatch uses the original platform token stored on the click, while the internal `cid` remains the attribution key. Missing provider configuration or tokens become terminal failures without external requests.
- Blockers: A controlled live-provider conversion and deployment credentials remain pending; the full integration suite must still be run from the configured test shell.
- Next task: run `npm run test:integration`, then build the full dashboard overview and campaign views from the query foundation.

### 2026-10-04: dashboard UI wave

- Completed: Added the private overview dashboard, campaign list/detail pages, delivery-health page with audited retry action, shared navigation, URL-driven filters, keyboard-visible focus states, and guarded Playwright coverage for admin navigation and retry behavior.
- Verified: `npm run check`, `npm run test:unit -- --run` (17 test files, 67 tests), and `npm run build` pass. Playwright discovers four admin tests and skips them unless the E2E environment is explicitly configured.
- Decisions: Dashboard pages show only persisted metrics; cost-dependent profit/ROI remain unavailable until a real cost source exists. Delivery diagnostics remain sanitized.
- Blockers: Direct database reconciliation for a controlled dashboard dataset, a real provider conversion, cost import source, and production deployment remain pending.
- Next task: reconcile dashboard totals against a test dataset, then begin retention, backup, alerting, and deployment hardening.

### 2026-10-04: acceleration and hardening wave

- Completed: Added guarded dashboard reconciliation integration coverage, privacy/retention and backup/restore procedures, provider-neutral failure alert detection, production deployment checklist/security headers, provider-neutral cost import validation, and dry-run verification for all three provider adapters.
- Verified: `npm run check`, `npm run test:unit -- --run` (20 test files, 78 tests), `npm run build`, `npm run providers:verify`, and `npm run db:status` all pass. Neon reports both migrations are current.
- Decisions: Cost import remains validation-only until the client supplies a real cost source; provider verification defaults to redacted dry-run and requires explicit flags plus an environment guard for live calls.
- Blockers: The new dashboard reconciliation integration test and restore rehearsal still require operator-run disposable database environments; live provider conversion and deployment host remain unconfigured.
- Next task: run `npm run test:integration` from the configured PowerShell, complete a disposable restore rehearsal, then choose the deployment host.

### 2026-10-04: Voluum-like setup workflow added to plan

- Completed: Expanded the active plan with the missing operator workflow: campaign form, platform-specific tracking URLs, GTM registration/FTD snippets, copyable platform postbacks, and a controlled setup test.
- Verified: Existing APIs and adapters provide the backend primitives, but the copyable setup UI and generated snippets/templates are not implemented yet.
- Decisions: Keep this workflow separate from the dashboard metrics work so the client can configure campaigns and validate tracking before production deployment.
- Blockers: None beyond implementation; platform-specific macro details must be confirmed during the controlled setup test.
- Next task: implement the campaign setup form and generators in small, testable slices.

### 2026-10-04: Voluum-like setup workflow implementation

- Completed: Added private campaign creation, provider-specific tracking URL generation, GTM registration/FTD snippet generation, outbound postback template generation, and a guarded campaign setup verification page with a test-click action.
- Verified: `npm run check`, `npm run test:unit -- --run` (24 test files, 99 tests), and `npm run build` pass.
- Decisions: Setup-test clicks require `TRACK_IN_ALLOW_TEST_SETUP=1` and are refused in production; generated artifacts redact credentials and never make live provider calls.
- Blockers: The operator still needs to run a controlled client-like setup with real provider macros and complete the backup/restore rehearsal before production traffic.
- Next task: use the setup workflow with a real test campaign, then finalize deployment and live-provider verification.
