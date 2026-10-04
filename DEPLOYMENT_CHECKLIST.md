# Deployment checklist

This checklist is host-neutral. Complete it before sending paid traffic to a production instance.

## Configuration

- [ ] Set `NODE_ENV=production`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the canonical public origin using `https://`.
- [ ] Set the pooled runtime `DATABASE_URL` and direct migration `DIRECT_URL` for the same PostgreSQL database.
- [ ] Set unique, long `ADMIN_USERNAME` and `ADMIN_PASSWORD` values. Do not use the example values.
- [ ] Set a unique `CONVERSION_WEBHOOK_SECRET` and share it only with the money-site backend.
- [ ] Confirm no `.env.local`, deployment export, build log, or error report contains credentials.

## Database and application

- [ ] Run `npm ci` from the lockfile.
- [ ] Run `npm run db:generate`.
- [ ] Run `npm run db:migrate` against the intended database. Never use schema synchronization in production.
- [ ] Run `npm run check` and `npm run build` before starting the release.
- [ ] Start with `npm run start` using the production environment.
- [ ] Confirm `/api/health` returns HTTP 200 and `{ "status": "ok" }`.
- [ ] Confirm `/api/readiness` returns HTTP 200 and `{ "status": "ready" }`.
- [ ] Confirm `/api/readiness` returns HTTP 503 when a required production variable is absent.

## HTTPS and security

- [ ] Terminate TLS at the host or reverse proxy and redirect HTTP to HTTPS.
- [ ] Confirm the application is reachable only through the intended public origin.
- [ ] Confirm production responses include `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- [ ] Confirm an unauthenticated `/admin` request returns `401` and does not reveal dashboard data.
- [ ] Confirm `/api/conversions` rejects missing or invalid bearer credentials.
- [ ] Confirm `/postback` rejects unknown `cid` values and does not redirect or create unattributed conversions.

## Tracking smoke test

- [ ] Create or verify one active campaign with an allowlisted destination.
- [ ] Send one controlled click through `/t/{campaign-slug}` and capture the resulting `cid`.
- [ ] Verify the money site receives the `cid` and can retain it through its conversion journey.
- [ ] Submit one controlled conversion and verify exactly one conversion and one durable outbound record.
- [ ] Replay the same conversion and verify it is reported as a duplicate without another outbound record.
- [ ] Force a transient provider failure and verify retry scheduling and eventual recovery.

## Operations

- [ ] Configure PostgreSQL backups and complete a restore rehearsal.
- [ ] Monitor readiness failures, outbound delivery failures, and application errors.
- [ ] Keep the operator runbook available for secret rotation, failed postbacks, unknown clicks, and database restore.
- [ ] Record the release commit, migration status, and smoke-test result.

The health endpoint is liveness only: it confirms the process can respond. Readiness validates required production configuration; database connectivity and provider delivery must still be verified through the smoke tests and operational monitoring.
