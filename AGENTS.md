# Minimal Conversion Tracker: Development Guide

This project is a self-hosted, personal-use conversion tracker. It records ad clicks, preserves attribution through a money site, receives server-to-server conversion events, and reports those conversions back to supported ad platforms. The dashboard exists to answer practical questions about campaign performance.

This is intentionally not a full Voluum clone. Build the smallest reliable system that reproduces the client's existing Voluum tracking workflow and produces trustworthy attribution and useful metrics.

## Product contract

### Goals

- Receive an ad click at a campaign tracking URL.
- Create a unique, opaque click ID and store the click and its accepted metadata.
- Redirect the visitor to the selected money-site destination while passing the click ID.
- Accept authenticated conversion events from the money site and Voluum-compatible browser/postback events, attributing each event to its original click.
- Send an idempotent outbound postback or conversion-API request to the configured ad platform when a conversion is accepted.
- Show useful campaign, click, conversion in a private dashboard.
- Be easy for one operator to deploy, inspect, and repair.

### Non-goals

Do not add these unless the owner explicitly changes this document:

- Affiliate-network offers, marketplaces, team workspaces, billing, or subscriptions.
- Rule-based traffic routing, traffic distribution, funnels, paths, rotators, or landing-page hosting.
- Bot detection, anti-fraud scoring, device fingerprinting, or cloaking.
- A generic integration catalog, visual workflow builder, report builder, or campaign automation.
- Cookies, cross-device attribution, multi-touch attribution, or retargeting features. A narrowly scoped Voluum-compatible postback endpoint is allowed because the client's existing GTM workflow depends on it.
- Native mobile apps, public APIs, or roles beyond a single private operator.
- Metrics that cannot drive a decision for this operator.

When a proposed feature does not directly improve click capture, conversion attribution, outbound reporting, or the dashboard's useful metrics, do not build it. Record it as a future idea instead.

## Default technical direction

Use a single Next.js application with TypeScript and PostgreSQL. Keep the web dashboard, authenticated administration, public tracking redirect, inbound conversion endpoint, and outbound postback worker in one deployable codebase.

- Use the current stable Next.js App Router and TypeScript strict mode.
- Use PostgreSQL as the source of truth. Model data explicitly and enforce uniqueness in the database.
- Use a migration-based ORM or query layer. Do not rely on schema synchronization in production.
- Treat the tracking redirect as latency-sensitive and keep its dependency chain short.
- Use a durable database-backed outbox/job table for outbound postbacks. A request must not lose a conversion merely because an ad-platform API is slow or unavailable.
- Store secrets only in environment variables or a managed secret store. Never commit them.
- Keep the application monolithic until measured scale or operational needs justify extracting a worker.

## System boundaries and data flow

```text
Ad platform
  -> GET /t/{campaign-slug}?platform-token=value
  -> Tracker creates Click ID and stores click context
  -> 302/307 redirect to money site with cid={click_id}
  -> Money site persists cid for its conversion journey
  -> POST /api/conversions from money-site backend, or GET /postback from the client's Voluum-compatible GTM tag
  -> Tracker validates, deduplicates, attributes, and records conversion
  -> Durable outbound-postback job
  -> Ad platform conversion API or postback endpoint
  -> Private dashboard reads aggregate and drill-down data from PostgreSQL
```

The money site must send the `cid` it received from the tracker. Never attempt to reconstruct attribution from IP address, user agent, timestamps, or other weak signals.

## Canonical concepts and database entities

Use UTC timestamps everywhere. Store money as integer minor units plus ISO 4217 currency code unless the project has a documented single-currency constraint.

### Campaign

A named tracking configuration, not an ad-platform campaign mirror.

- `id`, `slug` (unique, public-safe), `name`, `status`
- `destination_url` or a destination reference
- `traffic_source_id` (optional)
- `default_currency`, `created_at`, `updated_at`, `archived_at`

### TrafficSource

An outbound-reporting configuration for one ad platform/account.

- `id`, `name`, `type`, `enabled`
- encrypted credential or secret reference
- postback/conversion API configuration, token mapping, and retry policy
- never expose credentials through the dashboard API or logs

### Click

An immutable record of a successful tracking request.

- `id` (internal), `click_id` (opaque public identifier, unique)
- `campaign_id`, `traffic_source_id` when known
- `clicked_at`, normalized IP address or privacy-preserving representation as required, `user_agent`
- referrer, landing/destination URL actually used, and allowed inbound query parameters
- a structured JSON field for explicitly allowlisted platform tokens such as ad click IDs and campaign/ad-set/ad IDs

Do not put secrets, arbitrary request bodies, or unbounded query strings into this table. Set a retention policy for personal data before production.

### Conversion

An accepted event from the money site, tied to exactly one click.

- `id`, `click_id` (foreign key), `event_id` (idempotency key), `event_type`
- `occurred_at`, `received_at`, `value_minor`, `currency`
- optional order/transaction reference, stored only if needed for reconciliation
- immutable source payload summary or hash, validation state, and rejection reason when retained

Enforce the intended idempotency rule with a unique index, normally `(source, event_id)` or a money-site transaction reference. Replayed requests must return the original accepted result without creating another conversion or postback.

### OutboundPostback

A durable delivery attempt ledger for reporting an accepted conversion to an ad platform.

- `id`, `conversion_id`, `traffic_source_id`, `destination`
- `status`: `pending`, `processing`, `delivered`, `retryable_failed`, `permanently_failed`, `suppressed`
- attempt count, next-attempt timestamp, request fingerprint, response status, and sanitized response summary
- `delivered_at`, `last_error`, `created_at`, `updated_at`

One conversion may produce one outbound record per enabled destination. Enforce a unique key on `(conversion_id, traffic_source_id, destination)`.

### CostImport and DailyMetric (only when needed)

Add campaign costs only after click and conversion attribution work. Prefer imported daily cost records keyed by campaign and date. Derived dashboard totals should be queryable from primary facts, with aggregate tables introduced only after performance measurement.

## Public endpoint contracts

Version private APIs when external callers depend on them. Keep public tracking and money-site contracts stable and documented.

### `GET /t/{campaign-slug}`

Purpose: register a click and redirect.

Rules:

- Resolve only active campaigns. Return `404` for an unknown or inactive slug; do not redirect to a fallback.
- Generate a cryptographically strong opaque `click_id`. Do not encode campaign IDs, timestamps, or user data in it.
- Store only allowlisted request parameters. Keep original keys only where required for a platform postback.
- Construct the destination URL safely, append `cid={click_id}`, and preserve only approved destination parameters.
- Return a redirect immediately. Never call an ad platform during this request.
- Log a request/correlation ID and outcome, but do not log full query strings containing sensitive tokens.

The canonical outbound money-site parameter is `cid`. Support aliases only through an explicit campaign configuration and document them.

### `POST /api/conversions`

Purpose: accept a server-to-server conversion from the money-site backend.

Required JSON body:

```json
{
  "cid": "opaque-click-id",
  "event_id": "money-site-unique-event-id",
  "event_type": "purchase",
  "occurred_at": "2026-10-03T12:34:56Z",
  "value_minor": 500000,
  "currency": "IDR"
}
```

Contract:

- Authenticate with a per-money-site secret using a signed request or bearer secret over TLS. Reject unauthenticated requests.
- Validate schema, event size, currency, timestamps, and numeric ranges before writing.
- Require `cid` and a stable `event_id` for every event. Reject an unknown click with a clear, non-sensitive error code.
- Accept duplicate `event_id` requests idempotently. Do not enqueue duplicate outbound postbacks.
- On a new valid conversion, commit the conversion and its outbound-postback records in the same database transaction.
- Respond with a concise machine-readable result, for example `{ "status": "accepted", "conversion_id": "..." }` or `{ "status": "duplicate", "conversion_id": "..." }`.

### `GET /postback` (Voluum-compatible conversion intake)

Purpose: preserve the client's existing GTM/Voluum postback workflow for registration, FTD, and later event types.

Rules:

- Require a valid recorded `cid`; reject unknown click IDs and never create an unattributed conversion.
- Accept the Voluum-style query vocabulary used by the client: `cid`, `et` for event type, optional `txid` for a unique transaction, and optional `payout`/`value` plus `currency`.
- Treat the endpoint as intentionally public and lower-trust, matching the client's existing Voluum behavior. Protect it with rate limiting, strict input bounds, click-ID validation, and idempotency; do not add a bearer secret that browser GTM cannot keep private.
- Match Voluum duplicate behavior: repeat events for the same click and transaction are ignored; later events such as FTD are accepted only when their transaction/event identity is unique.
- On acceptance, create the same conversion and durable outbound-postback records as the authenticated endpoint.
- Return a concise success response suitable for an image/GTM request and never expose database details.
- Keep authenticated `POST /api/conversions` as the preferred money-site backend contract when available.

### Private administration endpoints

Protect dashboard and configuration routes with strong operator authentication. Keep campaign management, traffic-source setup, postback retry inspection, and cost import behind private routes. Do not expose a generic public API in the MVP; `/postback` is a deliberately narrow compatibility endpoint with a fixed query contract.

## Outbound postback delivery

- Build provider adapters behind a small interface. Each adapter owns request formatting, authentication, response classification, and token mapping for one platform.
- Include the platform's original click token when required. The tracker click ID is not automatically usable as an ad-platform click ID.
- Make delivery idempotent where the target supports an event ID or transaction ID.
- Retry transient failures with bounded exponential backoff and jitter. Do not retry clearly permanent 4xx validation failures.
- Provide a manual, audited retry action for failed deliveries in the dashboard.
- Sanitize logs and stored diagnostics. Never store authorization headers or full URLs containing secrets.
- Mark a job terminal only after success, explicit suppression, or retry exhaustion. Surface terminal failures prominently.

## Dashboard scope

The dashboard is private and decision-oriented. Start with a date-range filter, campaign filter, traffic-source filter, and event-type filter.

MVP views:

- Overview: clicks, unique click IDs, conversions, conversion rate, revenue, cost when available, profit, and ROI when cost is available.
- Campaign table: the same metrics by campaign, sortable and drillable.
- Campaign detail: daily trend plus recent clicks, conversions, and delivery failures.
- Delivery health: pending, retrying, and permanently failed outbound postbacks, with reason and manual retry.
- Configuration: campaigns, destinations, money-site authentication, and traffic-source adapter settings.

Define formulas in one shared module and display them consistently:

- `conversion_rate = conversions / clicks`
- `profit = revenue - cost`
- `roi = profit / cost`, shown as unavailable when cost is zero or missing

Do not add vanity charts, arbitrary report exports, cohort analysis, or metrics with unclear definitions. Every metric must trace to a persisted source record.

## Security and privacy requirements

- Require HTTPS in production. Enable secure cookies and standard security headers for private routes.
- Authenticate dashboard users and authorize every private action. Use least privilege for database and deployment credentials.
- Authenticate money-site API postbacks, compare secrets in constant time where applicable, and rate-limit the public compatibility endpoint without blocking legitimate ad traffic.
- Validate and allowlist redirect destinations. Never allow a request parameter to choose an arbitrary redirect URL.
- Use parameterized queries or a safe ORM. Validate all external input with schemas.
- Encrypt or use a secret manager for ad-platform credentials at rest. Redact secrets, click IDs where practical, and personal data from logs, traces, and error reports.
- Minimize personal data. Document retention periods and a deletion/anonymization process before handling real traffic.
- Record an audit entry for configuration changes and manual postback retries.

## Reliability and operational requirements

- Attribution writes must be transactional. A response that says a conversion was accepted must correspond to a committed conversion and durable delivery work.
- Public redirect failures must be observable and fail closed rather than sending traffic to an unknown destination.
- All inbound and outbound operations need correlation IDs suitable for support and reconciliation.
- Use database constraints as the final idempotency and referential-integrity layer.
- Provide health and readiness endpoints suitable for the chosen deployment environment.
- Back up PostgreSQL and rehearse restoring it before relying on the tracker for paid traffic.
- Keep an operator runbook for failed postbacks, unknown click IDs, secret rotation, database restore, and platform credential failures.

## Coding conventions

- TypeScript strict mode. Avoid `any`, implicit coercion, and unvalidated JSON.
- Separate domain logic from HTTP handlers and UI components. Route handlers should parse, authorize, call a use case, and format a response.
- Use explicit names: `clickId`, `eventId`, `valueMinor`, `trafficSource`. Do not overload `id` across public and internal identifiers.
- Keep campaign configuration declarative and versioned through migrations or audited changes.
- Prefer small modules and readable code over abstractions for hypothetical providers or future workflows.
- Make timestamps explicit and UTC. Do not use local server time for reporting boundaries without a documented business timezone.
- Never silently swallow failures. Return or record a classified error with enough context to repair it safely.
- Update this file when a deliberate architectural decision changes the product contract.

## Testing and acceptance expectations

Before merging a feature, test the behavior that affects money, attribution, redirects, or credentials.

Required automated coverage:

- Unit tests for click-ID generation, parameter allowlisting, redirect construction, validation, idempotency, metrics formulas, and provider payload construction.
- Integration tests against PostgreSQL for click creation, conversion acceptance, duplicate events, unknown click IDs, transactional outbox creation, and retry state changes.
- Contract tests for each configured money-site payload and ad-platform adapter.
- End-to-end tests for: ad click -> redirect with `cid` -> authenticated money-site conversion or Voluum-compatible `/postback` -> attributed conversion -> outbound delivery record -> dashboard metric.
- Security tests for unauthorized postbacks, invalid signatures/secrets, open-redirect attempts, malformed payloads, and secret redaction.

Manual production-readiness check:

1. Send a test click from each real ad platform integration.
2. Complete a controlled money-site conversion using the captured `cid`.
3. Confirm exactly one conversion, correct campaign attribution, and exactly one platform delivery.
4. Force a transient provider failure and confirm durable retry and recovery.
5. Force a permanent failure and confirm clear operator visibility without endless retries.

## Delivery phases

### Phase 0: foundations

Create the Next.js application, PostgreSQL schema, migrations, local environment setup, authentication approach, validation library, structured logging, and test harness. Write a short deployment and backup plan.

### Phase 1: trustworthy click and conversion loop

Implement campaigns, the tracking redirect, click storage, authenticated money-site conversion intake, idempotency, and a simple private view that verifies clicks and conversions. Do not build cost import or multiple platform adapters yet.

### Phase 2: outbound reporting

Implement the durable outbox, one real ad-platform adapter, retry handling, delivery health, and reconciliation tools. Validate against a real platform test setup before adding another adapter.

### Phase 3: useful dashboard

Implement overview, campaign detail, daily metrics, filters, and defined formulas. Add cost import only when it is needed to calculate a decision-relevant profit or ROI metric.

### Phase 4: hardening and operation

Finish retention controls, backups and restore test, alerting for delivery failures, audit records, runbook, production deployment, and a controlled end-to-end live-traffic verification.

## Change discipline

Before adding a feature, write down:

1. Which core job it improves: click capture, attribution, conversion intake, outbound reporting, or an existing dashboard decision.
2. The data it requires and its retention/privacy impact.
3. The failure mode it introduces and how it will be tested.
4. Why it belongs in the personal-use MVP instead of a future backlog.

If these questions do not have concise answers, do not implement the feature.
