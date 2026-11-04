---
title: "How to Track Registrations and Purchases as Separate Events"
description: "Define registration and purchase events, preserve ad click IDs, prevent duplicate reporting, and test both stages of your conversion funnel."
category: "Conversion tracking"
author: "Trakio team"
publishedAt: '2026-11-04'
status: draft
---

Tracking registrations and purchases as separate events shows where a visitor moves from creating an account to becoming a customer. The key is to define each event by a real outcome, keep the original ad click ID attached, and report the events consistently without counting one action twice.

## Decide what each event means

Write down the business condition that makes each event true before adding tags or server calls. For example:

- **Registration:** an account was successfully created—not just that someone opened or submitted a signup form.
- **Purchase:** an order was confirmed according to your business rules—not merely that checkout began or a payment button was clicked.

Use stable, distinct event names that your tracker and reports can recognize, such as `reg` and `purchase`. Avoid changing names casually after launch; inconsistent spellings can split one business outcome across multiple report rows. If you also use an analytics product, follow its naming conventions there. Google Analytics, for example, defines recommended `sign_up` and `purchase` events; those names are for GA4 and need not replace the event names configured in another tracker. See Google’s [recommended events reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

## Keep the click ID through the funnel

The click ID connects a later event to the ad visit. Trakio sends the destination a `cid` query parameter; your site must retain that exact value with the account or order and include it when reporting each event. Do not substitute a registration ID, order number, or another platform’s click token for `cid`. See [Why the click ID matters](https://trakio.org/articles/why-the-click-id-matters).

A typical sequence is: ad click → landing page receives `cid` → registration stores `cid` with the account → purchase retrieves that same `cid` from the account or order. This lets the purchase be reported later even if the customer returns in another session, provided your system retained the association.

## Send each outcome as its own event

If you control the backend, send events from the system that confirms the outcome. Trakio’s authenticated server-to-server intake accepts an `event_type` and a stable `event_id`, along with `cid` and an ISO 8601 `occurred_at` timestamp. For example, a confirmed registration and a later purchase should be separate events with different event types and event IDs:

```json
{
  "cid": "CLICK_ID_FROM_TRAKIO",
  "event_id": "account-582-registration",
  "event_type": "reg",
  "occurred_at": "2026-10-21T10:30:00Z"
}
```

```json
{
  "cid": "CLICK_ID_FROM_TRAKIO",
  "event_id": "order-1042-purchase",
  "event_type": "purchase",
  "occurred_at": "2026-10-22T08:15:00Z",
  "value_minor": 1299,
  "currency": "USD"
}
```

These are illustrative payload fields, not credentials or complete HTTP requests. Use the current [Trakio conversion setup documentation](https://trakio.org/docs) for the endpoint and authentication method. Send value and currency only when they apply and are represented correctly; the documented `value_minor` uses an integer in the currency’s minor units. Keep the bearer secret on a trusted server, never in browser code or a public tag.

For an existing Voluum-compatible browser or GTM postback workflow, Trakio documents `cid`, event type `et`, and a unique `txid`. Use the integration snippet from campaign setup and ensure the event fires only after the intended outcome. The public [postback workflow](https://trakio.org/docs) is distinct from authenticated server intake.

## Prevent duplicates without collapsing distinct events

Give each event a stable identifier. When retrying the same registration or purchase after a timeout, reuse that event’s ID; Trakio recognizes a repeated event ID as a duplicate. A later purchase is a different event and needs its own identifier. Do not reuse a single ID for both registration and purchase, or create a new ID on every retry.

If browser and server implementations can both report the same outcome, decide which is authoritative or use the receiving platform’s documented deduplication mechanism. Do not assume different systems deduplicate each other automatically.

## Test both stages before launch

1. Open a controlled campaign tracking link and confirm the destination receives `cid`.
2. Complete a test registration and check that the event appears once under the expected event name and campaign.
3. Complete a separate test purchase, if safe, and verify its click ID, timestamp, event type, and any intended value and currency.
4. Retry one event using the same ID and confirm the retry does not become a second conversion.
5. Check outbound postback delivery separately from the conversion record; a recorded event does not prove that a traffic source received it.
6. Align date range, timezone, and event filters when comparing reports.

See [How to Test a Conversion Tracking Setup Before Running Ads](https://trakio.org/articles/test-conversion-tracking-setup) for the full validation sequence, and [How to Set Up Server-to-Server Conversion Tracking](https://trakio.org/articles/server-to-server-conversion-tracking) for backend implementation guidance.

## Common mistakes

- Counting a form click as a completed registration or checkout start as a purchase.
- Losing `cid` during redirects, signup, or checkout.
- Sending both events under one event name, making funnel reporting ambiguous.
- Reusing one event ID for different outcomes—or changing it on every retry.
- Assuming that a tracker conversion record means the ad platform received its postback.
- Sending a purchase value without the correct currency or unit.

Track the outcomes that answer a real business question, preserve the original click association, and validate each event and delivery path independently.
