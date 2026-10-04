import {
  buildPropellerAdsRequest,
  deliverPropellerAdsRequest,
  type PropellerAdsConfig,
} from "@/lib/providers/propeller-ads";
import {
  buildTrafficJunkyRequest,
  deliverTrafficJunkyRequest,
  type TrafficJunkyConfig,
} from "@/lib/providers/trafficjunky";
import {
  buildTrafficStarsRequest,
  classifyTrafficStarsResponse,
  classifyTrafficStarsNetworkError,
  type TrafficStarsConfig,
} from "@/lib/providers/trafficstars";
import { parseProviderId, validateProviderConfiguration } from "@/lib/providers/config";
import type { DeliveryResult, OutboxDelivery, OutboxJob } from "@/lib/outbox/worker";

type FetchLike = typeof fetch;

function permanent(error: unknown): DeliveryResult {
  return {
    outcome: "failed",
    kind: "permanent",
    error: error instanceof Error ? error.message.slice(0, 500) : "Provider configuration is invalid.",
  };
}

function tokensFor(job: OutboxJob): Record<string, unknown> {
  if (job.clickTokens === undefined) throw new Error("Original click token data is missing.");
  return job.clickTokens;
}

function conversionFor(job: OutboxJob) {
  if (job.conversion === undefined) throw new Error("Conversion data is missing from the outbox job.");
  return job.conversion;
}

function originalTrafficStarsToken(job: OutboxJob): string {
  const tokens = tokensFor(job);
  for (const key of ["clickid", "click_id", "CLICKID", "CLICK_ID"]) {
    const value = tokens[key];
    if (typeof value === "string" && value.trim().length > 0 && value.length <= 256) return value.trim();
  }
  throw new Error("TrafficStars requires the original click token.");
}

/**
 * Turns provider-specific adapters into the generic outbox delivery function.
 * Configuration and original click tokens come from the persisted records; the
 * internal Track.in cid is never substituted for a provider token.
 */
export function createProviderOutboxDelivery(fetchImpl: FetchLike = fetch): OutboxDelivery {
  return async (job) => {
    try {
      const providerId = parseProviderId(job.providerId);
      const config = validateProviderConfiguration(providerId, job.providerConfiguration);
      const conversion = conversionFor(job);

      if (providerId === "trafficstars") {
        const request = buildTrafficStarsRequest(config as TrafficStarsConfig, {
          clickId: originalTrafficStarsToken(job),
          eventId: conversion.eventId,
          eventType: conversion.eventType,
          valueMinor: conversion.valueMinor,
          currency: conversion.currency,
          leadCode: conversion.eventId,
        });
        try {
          const response = await fetchImpl(request.url, { method: request.method, headers: request.headers });
          return classifyTrafficStarsResponse({ status: response.status });
        } catch (error) {
          return classifyTrafficStarsNetworkError(error);
        }
      }

      if (providerId === "propeller") {
        const request = buildPropellerAdsRequest(config as PropellerAdsConfig, tokensFor(job), conversion);
        const result = await deliverPropellerAdsRequest(request, fetchImpl);
        return result.outcome === "delivered"
          ? { outcome: "delivered", responseStatus: result.responseStatus, responseSummary: result.responseSummary }
          : { outcome: "failed", kind: result.kind ?? "transient", responseStatus: result.responseStatus, error: result.error ?? "Provider request failed." };
      }

      const request = buildTrafficJunkyRequest(config as TrafficJunkyConfig, tokensFor(job), {
        eventId: conversion.eventId,
        eventType: conversion.eventType,
        valueMinor: conversion.valueMinor,
        currency: conversion.currency,
      });
      return deliverTrafficJunkyRequest(request, fetchImpl);
    } catch (error) {
      return permanent(error);
    }
  };
}
