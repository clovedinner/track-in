import { buildPropellerAdsRequest } from "@/lib/providers/propeller-ads";
import { buildTrafficJunkyRequest } from "@/lib/providers/trafficjunky";
import { buildTrafficStarsRequest } from "@/lib/providers/trafficstars";
import {
  parseProviderId,
  validateProviderConfiguration,
  type ProviderConfiguration,
  type ProviderId,
  type PropellerProviderConfiguration,
  type TrafficJunkyProviderConfiguration,
} from "@/lib/providers/config";

export type ProviderVerificationInput = {
  providerId: ProviderId | string;
  configuration: unknown;
  sampleTokens: Record<string, unknown>;
  eventId?: string;
  eventType?: string;
  valueMinor?: bigint;
  currency?: string;
};

export type ProviderVerificationPlan = {
  provider: ProviderId;
  method: "GET";
  /** URL with every query value redacted. Never log the real request URL. */
  redactedUrl: string;
  queryKeys: string[];
  requiredTokenFound: boolean;
  externalCall: false;
};

function firstToken(tokens: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = tokens[key];
    if (typeof value === "string" && value.trim().length > 0 && value.length <= 256) return value.trim();
  }
  return undefined;
}

function redactUrl(rawUrl: string): { redactedUrl: string; queryKeys: string[] } {
  const url = new URL(rawUrl);
  const queryKeys = [...new Set([...url.searchParams.keys()])].sort();
  for (const key of url.searchParams.keys()) url.searchParams.set(key, "[redacted]");
  return { redactedUrl: url.toString(), queryKeys };
}

function buildRequest(input: ProviderVerificationInput, provider: ProviderId, config: ProviderConfiguration): { url: string; token: string | undefined } {
  const eventId = input.eventId ?? "verification-event";
  const eventType = input.eventType ?? "purchase";
  if (provider === "trafficstars") {
    const token = firstToken(input.sampleTokens, ["clickid", "click_id", "CLICKID"]);
    if (token === undefined) throw new Error("TrafficStars verification requires a sample clickid token.");
    return {
      url: buildTrafficStarsRequest(config, { clickId: token, eventId, eventType, valueMinor: input.valueMinor, currency: input.currency }).url,
      token,
    };
  }
  if (provider === "propeller") {
    const token = firstToken(input.sampleTokens, ["subid", "SUBID", "clickid", "CLICKID", "click_id", "CLICK_ID"]);
    if (token === undefined) throw new Error("PropellerAds verification requires a sample SUBID/clickid token.");
    return {
      url: buildPropellerAdsRequest(config as PropellerProviderConfiguration, input.sampleTokens, { eventType, valueMinor: input.valueMinor, currency: input.currency }).url,
      token,
    };
  }
  const token = firstToken(input.sampleTokens, ["ACLID", "aclid", "clickid", "click_id"]);
  if (token === undefined) throw new Error("TrafficJunky verification requires a sample ACLID token.");
  return {
    url: buildTrafficJunkyRequest(config as TrafficJunkyProviderConfiguration, input.sampleTokens, { eventId, eventType, valueMinor: input.valueMinor, currency: input.currency }).url,
    token,
  };
}

/**
 * Validate provider setup and construct a safe, non-network verification plan.
 * This function deliberately has no fetch dependency and cannot contact a provider.
 */
export function buildProviderVerificationPlan(input: ProviderVerificationInput): ProviderVerificationPlan {
  const provider = parseProviderId(input.providerId);
  const config = validateProviderConfiguration(provider, input.configuration);
  const request = buildRequest(input, provider, config);
  const redacted = redactUrl(request.url);
  return { provider, method: "GET", ...redacted, requiredTokenFound: request.token !== undefined, externalCall: false };
}

export function verifyProvidersDryRun(inputs: readonly ProviderVerificationInput[]): ProviderVerificationPlan[] {
  return inputs.map(buildProviderVerificationPlan);
}
