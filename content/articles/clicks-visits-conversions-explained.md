---
title: "Ad Clicks, Visits, and Conversions: What Each Metric Means"
description: "Learn how clicks, visits, and conversions differ, why their totals may not match, and how to troubleshoot each step of an ad tracking funnel."
category: "Conversion tracking"
author: "Trakio team"
publishedAt: '2026-11-05'
status: published
---

Clicks, visits, and conversions describe different steps in an advertising funnel. A click is an interaction with an ad or tracked link; a visit is an arrival recorded by your tracking or analytics system; a conversion is a defined outcome such as a registration or purchase. These numbers are related, but they are not interchangeable and should not be expected to match exactly.

## On this page
- [What each metric means](#what-each-metric-means)
- [Why counts differ](#why-clicks-visits-and-conversions-differ)
- [A simple funnel example](#a-simple-funnel-example)
- [How to diagnose the numbers](#how-to-diagnose-the-numbers)

## What each metric means

### Clicks
A click is recorded when someone interacts with an ad or tracked link, according to the source or tracker definition. A click report describes activity at that link—not necessarily a successfully loaded page or a unique person. Repeated interactions may produce multiple clicks, and automated link checks or filtering rules can affect what a system records. Check the specific platform’s definition.

### Visits
A visit is an arrival or visit record recognized by a tracker. In Trakio, the campaign tracking URL records a visit and redirects the visitor to the destination with a `cid` click ID. Other analytics products may report sessions, which are grouped interactions under that product’s rules rather than a universal synonym for visits. For example, Google Analytics defines a session as a period of interaction and uses a 30-minute inactivity timeout by default; settings and reporting methods can differ. See [Google Analytics sessions](https://support.google.com/analytics/answer/9191807?hl=en).

### Conversions
A conversion is an outcome you have defined and that your system reports—such as a completed registration, qualified lead, or purchase. A tracker can attribute it to a visit when the event arrives with the required identifier and the tracking system can match it. Trakio uses the original `cid` passed through the funnel; see [Why the click ID matters](https://trakio.org/articles/why-the-click-id-matters).

## Why clicks, visits, and conversions differ

Each metric is counted at a different point and may use different rules. Someone can click but leave before the destination loads; a redirect, browser, or network problem can interrupt the arrival. A person can revisit or interact more than once, while a report may group or filter those events differently. A conversion may happen later and be reported only if the event is sent and its click ID has been retained. Date ranges, time zones, attribution rules, invalid-traffic filtering, consent choices, and reporting delays can also affect comparisons.

Do not assume a fixed ratio between the counts or that any discrepancy proves tracking is broken. First compare definitions, filters, and time periods in the exact systems you are using.

## A simple funnel example

Suppose a campaign report records 100 clicks. The tracker records 92 visits, and the site reports 6 completed registrations. These counts alone do not establish whether the difference is expected: inspect whether clicks and visits use comparable filters and whether every registration was sent with the original click ID. If the goal is purchases, registrations and purchases should remain separate event types rather than being merged into one total.

The example is illustrative, not a benchmark. Your results depend on traffic, site behavior, event definitions, and measurement settings.

## How to diagnose the numbers

1. **Align the comparison.** Use the same campaign, date range, timezone, and relevant event filters where possible.
2. **Check the click destination.** Open the campaign tracking link and confirm the destination loads and receives the expected `cid`. Trakio’s [setup documentation](https://trakio.org/docs) explains its click-ID handoff.
3. **Trace the identifier.** Confirm the site preserves that same `cid` through redirects, signup, or checkout and includes it with the conversion.
4. **Verify the outcome event.** Confirm that the business action really occurred and that the correct event was sent once. Check the request response and tracker record.
5. **Separate attribution from delivery.** A conversion recorded by the tracker does not by itself prove that an outbound postback reached the traffic source; check delivery status independently.
6. **Investigate the break in sequence.** If the tracker has no visit, examine the campaign URL and redirect. If it has a visit but no conversion, inspect the event and identifier handoff. If it has the conversion but the source does not, check outbound delivery and source-side reporting.

For a complete prelaunch sequence, see [How to Test a Conversion Tracking Setup Before Running Ads](https://trakio.org/articles/test-conversion-tracking-setup). For missing-event diagnostics, read [Why Conversions Go Missing](https://trakio.org/articles/missing-conversions-troubleshooting).

## Key takeaway

Clicks measure link interactions, visits measure arrivals or tracked visits under a system’s rules, and conversions measure defined outcomes. Treat them as stages in a funnel, not duplicate counts. Compare definitions first, then trace the click ID and event through each system to locate a genuine tracking problem.
