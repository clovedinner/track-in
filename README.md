# Trakio

Trakio is a self-hosted, personal conversion tracker. It records ad clicks, passes an opaque `cid` to a money site, accepts server-to-server conversions, and reports accepted conversions to configured ad platforms.

The product scope and engineering rules live in [AGENTS.md](AGENTS.md). The implementation checklist lives in [PLAN.md](PLAN.md).

## Local setup

Prerequisites:

- Node.js 22 or later
- npm 11 or later

Install the application dependencies and create your local environment file:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Start the development server:

```powershell
npm run dev
```

Open `http://localhost:3000` in a browser. The initial page deliberately contains no tracker data or navigation. Dashboard and administration routes will arrive after the database, authentication, and tracking foundations exist.

Run the checks available in this bootstrap:

```powershell
npm run check
npm run build
```

### PostgreSQL and migrations

This project uses Neon, managed serverless PostgreSQL, with Prisma ORM. Create a Neon project and add both connection strings to `.env.local`:

- `DATABASE_URL`: Neon's pooled connection string for the running application.
- `DIRECT_URL`: Neon's direct, non-pooled connection string for Prisma migrations and Studio.

Generate Prisma Client after installing dependencies or changing `prisma/schema.prisma`:

```powershell
npm run db:generate
```

### Seed a safe test campaign

The repeatable test fixture uses the direct Neon connection and is disabled unless
explicitly enabled. It refuses to run with `NODE_ENV=production`:

```powershell
$env:TRACK_IN_ALLOW_TEST_SEED="1"
npm run db:seed:test
Remove-Item Env:TRACK_IN_ALLOW_TEST_SEED
```

It creates or refreshes the active `demo.test` campaign with an
`https://example.test/checkout` destination. The fixture does not create a traffic
source, so it cannot send an outbound platform postback.

Apply reviewed, append-only migrations to the Neon database with:

```powershell
npm run db:migrate
```

Use `npm run db:migrate:create` only on a non-production Neon branch when a schema change needs a new migration. Do not use schema synchronization or point development migration commands at production.

## Environment values

- `NEXT_PUBLIC_APP_URL`: the browser-visible application origin. Use `http://localhost:3000` locally.
- `NEXT_PUBLIC_TRACKER_URL`: optional dedicated tracking origin, such as `https://go.trakio.org`. Generated tracking URLs use this value while the dashboard remains on `NEXT_PUBLIC_APP_URL`.
- `DATABASE_URL`: Neon pooled PostgreSQL connection string for runtime queries. Do not commit a real connection string.
- `DIRECT_URL`: Neon direct PostgreSQL connection string used only by Prisma migration and Studio commands.
- `AUTH_SESSION_SECRET`: at least 32 random characters used to sign dashboard sessions. It is required in production. Generate one with `openssl rand -base64 32`.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: optional legacy Basic Auth fallback while migrating existing deployments. Email/password sessions are the normal dashboard login.
- `CONVERSION_WEBHOOK_SECRET`: server-to-server conversion authentication secret. It is required in production.

Never commit `.env.local` or credentials. Do not route tracking traffic to this application until Phase 4 production-readiness checks are complete.

Operational recovery procedures, including a disposable Neon restore rehearsal,
are documented in [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md).

### Configurable traffic-source postbacks

New traffic sources use the saved URL template rather than guessing a platform from the incoming macro. For example, External ID parameter `visitor_id` with TS token `${SUBID}` captures the incoming `visitor_id` value. An outgoing URL such as `https://provider.example/postback?clickid={externalid}&goal=8` substitutes that captured value without adding or renaming provider query fields.

Supported placeholders are `{externalid}` (the configured source token), `{clickid}` (the Trakio visit ID), `{event.id}`, `{event.type}`, `{transaction.id}` (transaction reference, falling back to event ID), `{payout}`, `{payout.minor}`, `{payout.currency}`, `{cost}`, and `{var1}` through `{var10}`. Payout uses the conversion currency's minor-unit precision. `{param.parameter_name}` and saved brace-style TS macros also resolve enabled mappings. Missing, disabled, unexpanded, or unknown referenced values fail delivery instead of guessing another token. Use `{externalid}`, not `{clickid}`, when the ad platform requires its original click token.

Single-URL and per-event delivery both use the durable outbox. Generic delivery accepts HTTP 2xx; timeouts, network errors, HTTP 408/425/429 and 5xx use the existing bounded retries. Other responses require operator attention. Redirects are not followed. Destinations must resolve only to public internet addresses; DNS results are pinned for the request, with a 10-second deadline. A successful HTTP response is not a guarantee that the platform has credited a conversion: verify each provider's test flow before paid traffic.

Existing sources keep their built-in adapters, including the corrected saved external-ID mapping for Propeller. No automatic production-data migration is performed. Deploy both the application and outbox worker to activate these changes; the JSON configuration needs no schema migration.

Before routing paid traffic to a production deployment, complete
[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md). `/api/health` is a liveness
check; `/api/readiness` validates required production configuration and returns
503 when the service is not configured to start safely.
