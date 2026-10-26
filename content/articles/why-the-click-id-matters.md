---
title: Why the click ID matters
description: How a click ID connects an ad visit to a later conversion without relying on guesswork.
category: Attribution basics
author: Trakio team
publishedAt: '2026-10-21'
status: published
---

A tracker can connect an ad visit to a later conversion when both events share a reliable identifier. In Trakio, that identifier is the click ID, or `cid`.

## It starts at the tracking link

When a visitor opens a campaign tracking URL, Trakio records the click and creates an opaque ID. It redirects the visitor to the configured destination with that ID attached as `cid`.

## The money site has to keep it

Your site should save the incoming `cid` alongside the visitor’s registration or order. When the event happens, send the same value to Trakio. Without it, Trakio cannot reliably determine which click produced the event.

## Use a stable event ID too

A unique event ID lets Trakio recognize a retry as the same conversion. That keeps a network timeout or repeated postback from recording the same order twice.

[Read the setup docs](/docs).
