# Deployment checklist

This checklist is host-neutral. Complete it before sending paid traffic to a production instance.

## Configuration

- [ ] Set `NODE_ENV=production`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the canonical public origin using `https://`.
- [ ] If using a dedicated tracking subdomain, set `NEXT_PUBLIC_TRACKER_URL` to its canonical `https://` origin and route it to the same application.
- [ ] Set the pooled runtime `DATABASE_URL` and direct migration `DIRECT_URL` for the same PostgreSQL database.
- [ ] Set a unique `AUTH_SESSION_SECRET` with at least 32 random characters. Do not use the example value.
- [ ] Add `trakio.org` to Resend, publish its SPF/DKIM records, and wait for domain verification.
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM=Trakio <billing@trakio.org>` in the production environment.
- [ ] Apply migrations before deploying email verification. Existing accounts are grandfathered as verified.
- [ ] Create a new account, confirm the welcome email arrives, verify it, then sign in. Check that a plan is required before dashboard access.
- [ ] Set a unique `CONVERSION_WEBHOOK_SECRET` and share it only with the money-site backend.
- [ ] Confirm no `.env.local`, deployment export, build log, or error report contains credentials.

## Automated VPS deployment

- [ ] Add GitHub Actions secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`.
- [ ] Optionally add `VPS_PORT` and `VPS_APP_DIR` (the defaults are `22` and `/root/app`).
- [ ] Confirm the VPS user can update the application directory, run npm, run Prisma migrations, and restart the `trakio` PM2 process.
- [ ] Confirm PM2 runs the `trakio-outbox` worker alongside the web process; verify accepted conversions move from `pending` to `delivered` or a visible retry/failure state.
- [ ] Confirm PM2 runs the `trakio-email` worker; verify welcome and invoice messages move from `pending` to `delivered` or a visible failure state.
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
