# Deployment checklist

This checklist is host-neutral. Complete it before sending paid traffic to a production instance.

## Configuration

- [ ] Set `NODE_ENV=production`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the canonical public origin using `https://`.
- [ ] Set the pooled runtime `DATABASE_URL` and direct migration `DIRECT_URL` for the same PostgreSQL database.
- [ ] Set a unique `AUTH_SESSION_SECRET` with at least 32 random characters. Do not use the example value.
- [ ] Open `/auth/sign-up` once to create the first operator account, then verify sign-in and sign-out. Keep account creation restricted at the deployment layer if public signup is not desired.
- [ ] Set a unique `CONVERSION_WEBHOOK_SECRET` and share it only with the money-site backend.
- [ ] Confirm no `.env.local`, deployment export, build log, or error report contains credentials.

## Automated VPS deployment

- [ ] Add GitHub Actions secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`.
- [ ] Optionally add `VPS_PORT` and `VPS_APP_DIR` (the defaults are `22` and `/root/app`).
- [ ] Confirm the VPS user can update the application directory, run npm, run Prisma migrations, and restart the `trakio` PM2 process.
- [ ] Run the workflow manually once, then verify that a push to `main` creates one successful deployment.
- [ ] Keep production environment files only on the VPS; the workflow never copies `.env.production` from GitHub.

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
- [ ] Confirm an unauthenticated `/admin` request redirects to `/auth/sign-in` and does not reveal dashboard data.
- [ ] Confirm invalid email/password credentials are rejected and a successful sign-in reaches `/admin/dashboard`.
- [ ] Confirm sign-out clears the session and protected pages require sign-in again.
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
