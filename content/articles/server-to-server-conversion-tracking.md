---
title: "How to Set Up Server-to-Server Conversion Tracking"
description: "Learn how to preserve click IDs, send backend conversion events securely, prevent duplicates, and verify tracking and postback delivery."
category: "Conversion tracking"
author: "Trakio team"
publishedAt: '2026-10-28'
status: published
---

Server-to-server (S2S) conversion tracking sends an event from a website or partner backend to a tracking system, rather than relying only on a browser event at the moment of conversion. It is useful when the system that confirms a registration, payment, or qualified lead can report that outcome directly. S2S does not fix missing identifiers or incorrect event data: the click ID still has to survive from the ad visit to the conversion.

## How server-to-server conversion tracking works

1. A visitor arrives through a campaign tracking link. The tracker records the click and supplies an identifier, such as Trakio’s `cid`.
2. The site captures that identifier and stores it with the visitor, account, or order so it remains available through later steps.
3. The backend confirms a conversion and sends the identifier plus the event details to the tracker’s documented endpoint.
4. The tracker matches the event to the click and may send a separate postback to the traffic source.

These are distinct operations: accepting an incoming conversion does not prove that an outbound postback reached the ad platform. Check both sides.

## Before implementation

- Define the event precisely: for example, a completed registration rather than a form-button click, or a payment confirmed by the order system rather than checkout started.
- Identify the source of truth for that event and the backend or partner that can send it.
- Confirm the tracker’s current endpoint, authentication method, required fields, event names, and response behavior. Do not copy endpoint details from another vendor’s integration.
- Decide how the original click ID will be associated with a user or transaction, including redirects and multi-step flows.
- Review consent, privacy, retention, and applicable legal requirements for the data you plan to process.

## A practical implementation sequence

### 1. Capture and persist the click ID

Read the identifier from the landing URL and store it server-side or alongside the user/session record. Carry it through registration, checkout, and later fulfillment. If a visitor returns on another device or a partner completes the transaction, ensure the system handling the conversion can retrieve the correct identifier. Never substitute an order ID or a different platform’s click token for the tracker’s ID.

### 2. Send only confirmed events

Trigger the request from the system that knows the outcome occurred. For a purchase, that is usually a confirmed payment or order state, not merely a browser button click. For a lead, it may be the CRM stage that represents a qualified lead. Choose event names and values that match the receiving tracker’s configuration.

### 3. Include a stable event identifier

Give each conversion a unique event or transaction ID when supported. Reuse the same ID when retrying the same event after a timeout; use a new ID for a genuinely different conversion. Follow the receiving system’s documented duplicate-handling rules.

### 4. Protect credentials and validate requests

Keep bearer secrets and API keys on a trusted server, not in page source, browser JavaScript, GTM variables, or public repositories. Use HTTPS. Validate that the event corresponds to a real business outcome, apply appropriate access controls, and avoid logging credentials or unnecessary personal data. Retry transient failures according to the provider’s guidance, with safeguards against duplicate records.

### 5. Inspect the response and reconcile delivery

Record the request outcome using non-secret diagnostic information. A successful HTTP response may indicate that the tracker accepted an event, while attribution and outbound delivery may require separate checks. Monitor rejected events, unknown identifiers, delivery failures, and retries.

## Trakio example: server-side conversion intake

Trakio’s [current setup documentation](https://trakio.org/docs) specifies this flow: its campaign link sends the visitor to the site with `cid`; the site preserves that value and sends it with a conversion. The documented authenticated server intake uses a provisioned conversion webhook secret and fields including `cid`, `event_id`, `event_type`, and `occurred_at`; optional value reporting uses `value_minor` and `currency`. Keep the secret on the server. The documentation states that a recognized retry with the same event ID returns a duplicate status. Use the exact event values and credentials provisioned for your account; the following is a placeholder shape, not a credential:

```json
{
  "cid": "CLICK_ID_FROM_TRACKING_LINK",
  "event_id": "order-1042-purchase",
  "event_type": "purchase",
  "occurred_at": "2026-10-21T10:30:00Z",
  "value_minor": 1299,
  "currency": "USD"
}
```

See [Trakio documentation: your first tracked conversion](https://trakio.org/docs) for the current endpoint, required fields, and end-to-end verification. For the identifier’s role, read [Why the click ID matters](https://trakio.org/articles/why-the-click-id-matters).

## Testing before launch

1. Use a controlled test click and verify that the destination receives the expected click ID.
2. Complete a test event through the real backend path; confirm the backend uses the stored original ID and the intended event name.
3. Inspect the response and the tracker’s recent conversion record. Check event time, campaign, and any reported value.
4. Retry the same test event with the same event identifier where the integration supports it; confirm the documented duplicate behavior.
5. Check the tracker’s outbound delivery health separately and confirm the traffic source receives the expected postback.
6. Compare reports using aligned date ranges, timezone, event definitions, and filters.

## Common implementation failures

- **Identifier lost in a redirect or signup flow:** inspect each transition and persist the value before the URL changes.
- **Conversion sent too early:** trigger from the confirmed backend state, not an unverified browser interaction.
- **Duplicate events:** use a stable event ID and retry the same event with the same ID when supported.
- **Wrong event mapping:** compare the emitted name with the conversion rule configured in the tracker.
- **Accepted event but no source-platform conversion:** inspect outbound postback configuration and delivery logs; these are separate from incoming event acceptance.
- **Credential exposed in client code:** move authenticated calls to a trusted backend and rotate exposed credentials.

## Frequently asked questions

### Does server-to-server tracking guarantee every conversion is recorded?
No. The backend must receive the outcome, retain the correct click identifier, and successfully send a valid event. Monitor failures and test the full path.

### Is S2S always better than a browser pixel?
Not universally. The appropriate method depends on which system observes the event, the destination’s supported integrations, and operational requirements. A backend event can be useful when the server is the source of truth, but it still needs correct data, secure credentials, and reliable delivery.

### What should I do if I do not control the site backend?
Check whether the site, affiliate partner, or CRM offers a supported postback or integration that can return the original click ID. If not, confirm what browser or tag-based method the tracker and platform support, and test its limitations before launch.

## Further reading

- [Trakio setup documentation](https://trakio.org/docs)
- [Why the click ID matters](https://trakio.org/articles/why-the-click-id-matters)
- [Conversion tracking basics](https://trakio.org/articles/what-is-conversion-tracking)
- [Google Ads API conversion management documentation](https://developers.google.com/google-ads/api/docs/conversions/overview)
