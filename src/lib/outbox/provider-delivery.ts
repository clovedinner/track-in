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
import { buildGenericPostbackRequest } from "@/lib/providers/generic";
import { sendPublicPostback, UnsafePostbackDestinationError, type PostbackTransport } from "@/lib/providers/postback-transport";

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

function originalTrafficStarsToken(job: OutboxJob, config: TrafficStarsConfig): string {
  const tokens = tokensFor(job);
  const configuredParameter = config.externalId?.enabled !== false ? config.externalId?.parameter : undefined;
  if (configuredParameter) {
    const configuredValue = tokens[configuredParameter];
    if (typeof configuredValue === "string" && configuredValue.trim().length > 0 && configuredValue.length <= 256) {
      return configuredValue.trim();
    }
  }
  for (const key of ["clickid", "click_id", "CLICKID", "CLICK_ID"]) {
    const value = tokens[key];
    if (typeof value === "string" && value.trim().length > 0 && value.length <= 256) return value.trim();
  }
  throw new Error("TrafficStars requires the original click token.");
}

/**
 * Turns provider-specific adapters into the generic outbox delivery function.
 * Configuration and original click tokens come from the persisted records; the
 * internal Trakio cid is never substituted for a provider token.
 */
export function createProviderOutboxDelivery(fetchImpl: FetchLike = fetch, genericTransport: PostbackTransport = sendPublicPostback): OutboxDelivery {
  return async (job) => {
    try {
      const providerId = parseProviderId(job.providerId);
      if (job.providerConfiguration === null || typeof job.providerConfiguration !== "object" || Array.isArray(job.providerConfiguration)) {
        throw new Error("Provider configuration is invalid.");
      }
      // The destination is snapshotted onto the durable outbox row at conversion
      // acceptance, so retries keep using that event's original configured URL.
      const config = validateProviderConfiguration(providerId, {
        ...(job.providerConfiguration as Record<string, unknown>),
        postbackUrl: job.destination,
      });
      const conversion = conversionFor(job);

      if (providerId === "generic") {
        const request = buildGenericPostbackRequest(config, tokensFor(job), conversion);
        try {
          const { status } = await genericTransport(request);
          if (status >= 200 && status < 300) return { outcome: "delivered", responseStatus: status, responseSummary: "Postback endpoint returned a successful HTTP response." };
          return { outcome: "failed", kind: [408, 425, 429].includes(status) || status >= 500 ? "transient" : "permanent", responseStatus: status, error: `Postback endpoint returned HTTP ${status}.` };
        } catch (error) {
          return { outcome: "failed", kind: error instanceof UnsafePostbackDestinationError ? "permanent" : "transient", error: error instanceof UnsafePostbackDestinationError ? error.message : "Postback network request failed or timed out." };
        }
      }

      if (providerId === "trafficstars") {
        const request = buildTrafficStarsRequest(config as TrafficStarsConfig, {
          clickId: originalTrafficStarsToken(job, config as TrafficStarsConfig),
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
