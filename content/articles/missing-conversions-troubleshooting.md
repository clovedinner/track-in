---
title: "Why Conversions Go Missing: Common Tracking Problems and Checks"
description: "Diagnose missing or unattributed conversions by tracing the click ID, event request, reporting filters, and postback delivery step by step."
category: "Conversion tracking"
author: "Trakio team"
publishedAt: '2026-10-30'
status: draft
---

Missing conversions are frustrating, but the symptom usually points to a specific part of the tracking chain. A conversion can fail to arrive, arrive without attribution, be recorded under an unexpected event, or be present in the tracker while the ad platform never receives its postback. Diagnose those cases separately instead of changing campaign settings at random.

## Start by locating where the event disappears

Write down one affected conversion’s time and timezone, expected event name, campaign, and (if available) order or registration reference. Compare the systems that handle it in sequence: your site or backend, Trakio, then the traffic source. Avoid sharing secrets or personal customer data in screenshots.

- If your backend never recorded the outcome, investigate the site or business process first.
- If the backend recorded it but Trakio has no event, inspect the incoming conversion request and its response.
- If Trakio recorded it but it has no campaign attribution, trace the click ID.
- If Trakio shows a matched conversion but the ad platform does not, inspect outbound delivery separately.

Trakio’s [conversion tracking documentation](https://trakio.org/docs) describes checking both the conversion and delivery health; these are distinct results.

## Check the click ID from click through conversion

Trakio passes a click identifier named `cid` to the destination. The site must preserve the same value through redirects, registration, and checkout, then send it with the conversion. Do not substitute an ad-platform token, an order number, or a newly generated value.

For a test, open the generated campaign tracking link and confirm the landing flow receives `cid`. Then verify that the exact value is stored with the relevant registration or order and returned when the event is sent. If an intermediate redirect or signup step drops the parameter, repair that handoff before testing again. See [Why the click ID matters](https://trakio.org/articles/why-the-click-id-matters) for the identifier’s role.

## If the conversion request is missing or rejected

For a server-to-server integration, inspect the sender’s request log and response for the specific event. Check that the request uses the documented endpoint, that required fields are present, and that `cid` is the original recorded ID. Trakio’s server intake also uses a provisioned bearer secret: keep it server-side and never include it in browser code, public tickets, or screenshots. A rejected request is different from an accepted event that cannot be attributed.

Use the current [Trakio setup documentation](https://trakio.org/docs) for the request contract and response meanings. If an accepted event is retried, reuse its stable `event_id`; use a different ID for a distinct event. This makes retries distinguishable from new outcomes.

## If the event arrives but has no campaign

A conversion without the expected campaign usually calls for an identifier check, not a bid or budget change. Compare the click ID at the destination with the one submitted in the conversion. Confirm the original click exists and that the value was not truncated, URL-decoded incorrectly, overwritten, or replaced during a later step. For delayed conversions, use the original click ID retained with that customer or order.

Also verify that the conversion belongs to the campaign and date range you are viewing. Reporting filters and timezone can make a recorded event appear absent from a particular report.

## If Trakio records it but the ad platform does not

First confirm the conversion is matched in Trakio. Then inspect delivery health for the corresponding outbound postback, including whether it was queued and any reported failure reason. Verify the traffic source’s configured postback and that its expected external click token is available. Correct the configuration before retrying an eligible failed delivery; a successful incoming conversion does not by itself prove that the source received the event.

## Check event names, duplicates, and report filters

Make sure the event type sent by your site matches the event you configured and the event selected in the report. Check the campaign, date range, timezone, and event filters before concluding that the record is missing. If a retry may have occurred, use the same stable event identifier for the same conversion; do not create a new identifier merely to force another count.

## A practical troubleshooting sequence

1. Confirm the real outcome occurred in the site or order system, and note its timestamp with timezone.
2. Find the click ID issued for that visit and confirm the site preserved it to the conversion.
3. Check the incoming event request, required fields, and response; correct any rejection before retrying.
4. Search Trakio using the relevant campaign, time window, and event, checking whether the event is matched or unattributed.
5. If it is matched, inspect delivery health and the traffic source’s receipt or logs.
6. Re-run a controlled test using a fresh campaign click after the fix, and verify both attribution and outbound delivery.

For an end-to-end prelaunch check, follow [How to Test a Conversion Tracking Setup Before Running Ads](https://trakio.org/articles/test-conversion-tracking-setup). For implementation details, see [How to Set Up Server-to-Server Conversion Tracking](https://trakio.org/articles/server-to-server-conversion-tracking).

## Frequently asked questions

### Why does a conversion show in my site but not in Trakio?

The event may not have been sent, may have been rejected, or may lack the click ID needed for attribution. Check the sender’s request and response, then verify the original `cid` was preserved and included.

### Why is the conversion in Trakio but not in my ad platform?

Incoming conversion recording and outbound postback delivery are separate. Check Trakio delivery health and the traffic source’s configuration and receipt logs.

### Should I resend a missing event?

Only after checking whether the original request was accepted. For the same event, preserve its stable event identifier when retrying, and avoid creating duplicate records or using an unverified click ID.
