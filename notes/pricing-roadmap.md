# Subscription direction

Owner direction, 2026-10-21. This is a roadmap, not implemented entitlement logic.

| Plan | Current monthly USD price | Planned active campaign allowance | Planned additional service |
| --- | ---: | ---: | --- |
| Starter | 300 | 10 | Core tracking |
| Operator | 500 | 50 | Customer-facing API for the customer's own tools |
| Expanded | 1,000 | 100 | Customer-facing API plus dedicated customer service |

Conversion intake and outbound postbacks remain core tracking features for every plan. The planned customer API is distinct from the existing conversion endpoint. It is not an automatic ad-platform cost import integration.

The current release has no campaign entitlement enforcement, customer-facing reporting/configuration API, or dedicated support workflow. The public pricing page labels these differences as planned. Do not promote them to current inclusions until they ship.

Before implementing:

- Count active campaigns per account and define pause, archive, upgrade, downgrade, and existing-over-limit behavior. Enforce changes transactionally to prevent concurrent activation exceeding the limit.
- Define a small customer API around concrete customer use cases, with account-scoped credentials, authorization, rate limits, audit entries, rotation, and revocation. Keep conversion webhook credentials separate.
- Define how the dedicated support contact is assigned and reached before promising a response time or availability window.

Suggested differentiation: campaign capacity first, customer API access second, dedicated support third. Avoid restricting attribution correctness, duplicate prevention, or delivery retries by plan.
