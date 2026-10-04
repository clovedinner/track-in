# Phase 0 Acceptance Gate

This is the evidence gate for Phase 0, foundations. It converts the requirements in `AGENTS.md`, `PLAN.md`, `DATABASE_DESIGN.md`, and `TEST_STRATEGY.md` into observable checks. It does not replace those documents and does not mark any implementation task complete.

## Scope and current evidence

Phase 0 is accepted only when a developer can start from a clean checkout and complete the documented local setup, database migration, application startup, and full verification suite without production credentials or manual schema changes.

Current repository evidence, recorded on 2026-10-03:

| Area | Evidence present now | Acceptance status |
| --- | --- | --- |
| Product and operational contract | `AGENTS.md` | Not verified, policy only. |
| Active delivery checklist | `PLAN.md` | Not verified, checklist only. |
| Initial PostgreSQL design | `DATABASE_DESIGN.md` | Not verified, design only. |
| Test plan | `TEST_STRATEGY.md` | Not verified, strategy only. |
| Runnable application, migrations, local database configuration, tests, or CI | None found when this gate was created | Not implemented or not yet evidenced. |

Do not mark Phase 0 complete from documentation alone. Record each command's exit code and concise output in the evidence log below after the corresponding implementation exists.

## Preconditions

- Use a clean working tree and a supported Node.js LTS release selected by the project.
- Use a disposable Neon branch or another separately provisioned test database for `TEST_DATABASE_URL`; it must never equal the application's `DATABASE_URL`.
- Use only `.test` destinations, generated fixtures, and test-only secrets. Do not insert production credentials, domains, customer data, click IDs, IP addresses, or money-site events.
- Copy `.env.example` to `.env.local` and populate only local placeholders. `.env.local` must remain ignored by Git.
- Run the commands from the repository root in PowerShell unless a later documented package-manager choice changes the commands.

## Clean-setup verification

Run these checks in a newly cloned checkout after the bootstrap implementation is present:

```powershell
git status --short
npm ci
Copy-Item .env.example .env.local
npm run db:up
npm run db:migrate
npm run dev
```

Expected evidence:

- `git status --short` is empty before local setup, except for explicitly documented local files after copying the environment file.
- `npm ci` succeeds using the committed lockfile.
- `.env.example` supplies every required variable name with safe placeholders, and application startup reports missing required production configuration safely without printing values.
- `npm run db:up` starts the reproducible local PostgreSQL environment and exposes only local development ports.
- `npm run db:migrate` applies the initial migration to an empty database without schema synchronization.
- `npm run dev` starts the application with local configuration. Capture the startup URL and stop the process after the HTTP checks below.

If the chosen scripts differ from these names, update this document and `README.md` in the same change that introduces the toolchain. Do not silently substitute manual commands.

## Repository and configuration checks

```powershell
Get-ChildItem -Force -Name
Get-Content .gitignore
Get-Content .env.example
git check-ignore -v .env.local
npm run lint
npm run typecheck
npm run build
```

Acceptance criteria:

- The project is a Next.js App Router TypeScript project with strict type checking enabled.
- `.gitignore` excludes local environment files, build output, local database data, logs, coverage, and test artifacts.
- `.env.example` contains names and non-sensitive placeholders only. It must not contain actual keys, tokens, connection strings, or credentials.
- `git check-ignore -v .env.local` identifies the ignore rule that protects `.env.local`.
- Linting produces no warnings or errors, type checking produces no errors, and the production build succeeds.
- Package scripts exist for `dev`, `build`, `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `test`, and `check`. Database scripts must be documented, including the local PostgreSQL start and migration commands.

## Migration and schema verification

Use a fresh disposable database. The exact inspection command may use the selected migration tool, but it must prove that migrations, rather than application startup or schema synchronization, created the schema.

```powershell
npm run db:down
npm run db:up
npm run db:migrate
npm run db:migrate
npm run test:integration -- --runInBand
```

Acceptance criteria:

- The migration history includes a reviewed initial migration, expected to implement the schema described in `DATABASE_DESIGN.md`.
- Applying migrations to an empty database succeeds, and applying them a second time is a no-op.
- PostgreSQL contains the required tables: `traffic_sources`, `campaigns`, `clicks`, `conversions`, and `outbound_postbacks`.
- It contains the intended enums, foreign keys using restrictive deletion behavior, unique constraints for public click IDs, `(source, event_id)`, and `(conversion_id, traffic_source_id, destination)`, plus the defined checks and worker/query indexes.
- Migration verification proves duplicate click IDs are rejected, duplicate conversion events do not create another outbox record, invalid foreign keys are rejected, and constrained invalid state is rejected.
- Migration and integration tests use `TEST_DATABASE_URL` or a Testcontainers-provided disposable URL. They refuse to run when it matches normal development or production database configuration.

## HTTP, health, and private-boundary checks

Start the app with test-only local configuration, then run:

```powershell
Invoke-WebRequest http://localhost:3000/api/health
Invoke-WebRequest http://localhost:3000/api/readiness
Invoke-WebRequest http://localhost:3000/admin -MaximumRedirection 0
```

Acceptance criteria:

- Health returns a machine-readable success response without disclosing environment variables, database credentials, or internal configuration.
- Readiness verifies the dependencies required for serving traffic, including database reachability when the application is configured to use PostgreSQL. A dependency failure returns an unhealthy status safely.
- The administration route is protected by the selected private authentication boundary. An unauthenticated request must not reveal private dashboard or configuration data.
- Every HTTP request is associated with a correlation/request ID that is returned or logged in a documented safe form.
- Structured logs redact authorization, secrets, full sensitive query strings, and personal data according to `AGENTS.md`.

## Test-runner and safety checks

```powershell
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
npm run check
```

Acceptance criteria:

- Unit tests include at least one smoke test and can run without PostgreSQL or external network access.
- Integration tests apply migrations to an isolated PostgreSQL database and never fall back to `DATABASE_URL`.
- End-to-end tests run the built application against a dedicated test configuration, intercept external provider traffic, and never contact a real ad platform.
- `npm run test` executes all three test layers in a safe, documented order.
- `npm run check` runs linting, type checking, all tests, and the production build, failing on any failed stage.
- Test fixtures contain only test-specific values and reserved `.test` destinations. No production secrets or personal data appear in committed files, command output, or logs.

## Required implementation evidence by Phase 0 workstream

| Workstream | Required proof before its plan item may be checked |
| --- | --- |
| Project setup | Clean install, local startup, documented README path, and successful production build. |
| Database and migrations | Fresh migration, no-op re-run, integration evidence for constraints and transactional behavior. |
| Application foundations | Invalid configuration failure, schema-validation smoke tests, correlation-aware redacted logging, health/readiness responses, and unauthenticated admin rejection. |
| Test foundations | Each runner executes, database isolation guard is demonstrated, provider network is intercepted, and `npm run check` succeeds. |

## Phase 0 completion decision

All statements below must be true:

- [ ] The clean-setup path has been performed from a fresh checkout and recorded below.
- [ ] `README.md` documents that exact path, including prerequisites and safe local environment setup.
- [ ] The application starts locally, the database is created solely through migrations, and migrations are repeatable.
- [ ] Invalid configuration fails clearly and safely, with no secret exposure.
- [ ] Health, readiness, private-route protection, structured request IDs, and redaction behavior are verified.
- [ ] Unit, integration, and end-to-end runners are configured and safe by default.
- [ ] `npm run check` succeeds from a clean install.
- [ ] The two Phase 0 acceptance tasks in `PLAN.md` are updated only after the evidence is attached and reviewed.

## Evidence log

Append factual results only. Include date, commit or revision when available, exact command, exit code, and a short sanitized summary. Do not place secrets, real database URLs, bearer tokens, money-site payloads, or full sensitive logs here.

| Date | Revision | Command | Exit code | Sanitized result | Follow-up |
| --- | --- | --- | --- | --- | --- |
| 2026-10-03 | Not applicable | Repository baseline inspection | 0 | Only planning/design documents were present. No runnable implementation evidence existed. | Populate after bootstrap. |

## Failure handling

- If a command fails, preserve the sanitized error and identify the smallest corrective task. Do not check related plan items.
- If a test can reach a non-test database or real provider endpoint, stop the suite and correct the isolation guard before continuing.
- If migrations require a manual database change, treat Phase 0 as failed until the change is represented by a reviewed migration and clean-database verification passes.
- If logs or errors reveal a secret, revoke or rotate it outside this document, remove it from retained diagnostic output, and add a regression test for redaction.
