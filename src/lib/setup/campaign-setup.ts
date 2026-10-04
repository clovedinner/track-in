import { buildCampaignTrackingUrl } from "@/lib/tracking/campaign-url";
import { generateDefaultGtmSnippets } from "@/lib/setup/gtm-snippets";
import { parseProviderId, validateProviderConfiguration, type ProviderId } from "@/lib/providers/config";

export type CampaignSetupInput = {
  id: string;
  slug: string;
  name: string;
  status: string;
  destinationUrl: string;
  defaultCurrency: string;
  allowedTrackingParameters: unknown;
  trafficSource: {
    type: string;
    enabled: boolean;
    configuration: unknown;
  } | null;
};

export type CampaignSetupReport = {
  campaign: { id: string; name: string; slug: string; status: string; destinationUrl: string };
  trackerBaseUrl: string;
  trackingUrls: Partial<Record<ProviderId, string>>;
  gtm: ReturnType<typeof generateDefaultGtmSnippets>;
  checks: {
    campaignActive: boolean;
    destinationHttps: boolean;
    providerConfigured: boolean;
    providerEnabled: boolean;
    providerTokenAllowlisted: boolean;
    externalCalls: false;
  };
  provider: ProviderId | null;
  providerError: string | null;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function safeProvider(value: string | undefined): ProviderId | null {
  if (!value) return null;
  try { return parseProviderId(value); } catch { return null; }
}

function hasProviderToken(provider: ProviderId | null, allowed: string[]): boolean {
  if (!provider) return false;
  const tokenParameter = provider === "trafficstars" ? "clickid" : provider === "propeller" ? "subid" : "ACLID";
  return allowed.some((name) => name.toLowerCase() === tokenParameter.toLowerCase());
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Application URL must use HTTP or HTTPS.");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function buildCampaignSetupReport(input: CampaignSetupInput, trackerBaseUrl: string): CampaignSetupReport {
  const baseUrl = normalizeBaseUrl(trackerBaseUrl);
  const allowedTrackingParameters = asStringArray(input.allowedTrackingParameters);
  const provider = safeProvider(input.trafficSource?.type);
  let trackingUrls: Partial<Record<ProviderId, string>> = {};
  let trackingError: string | null = null;
  if (provider) {
    try {
      trackingUrls = { [provider]: buildCampaignTrackingUrl({ trackerBaseUrl: baseUrl, campaignSlug: input.slug, provider, allowedTrackingParameters }) };
    } catch (error) {
      trackingError = error instanceof Error ? error.message : "Tracking URL configuration is invalid.";
    }
  }
  let providerError: string | null = null;
  let providerConfigured = false;
  if (input.trafficSource && provider) {
    try { validateProviderConfiguration(provider, input.trafficSource.configuration); providerConfigured = true; }
    catch (error) { providerError = error instanceof Error ? error.message : "Provider configuration is invalid."; }
  } else if (input.trafficSource) {
    providerError = "Traffic source type is not supported.";
  }
  providerError ??= trackingError;

  return {
    campaign: { id: input.id, name: input.name, slug: input.slug, status: input.status, destinationUrl: input.destinationUrl },
    trackerBaseUrl: baseUrl,
    trackingUrls,
    gtm: generateDefaultGtmSnippets(baseUrl),
    checks: {
      campaignActive: input.status === "active",
      destinationHttps: input.destinationUrl.startsWith("https://"),
      providerConfigured,
      providerEnabled: input.trafficSource?.enabled === true,
      providerTokenAllowlisted: hasProviderToken(provider, allowedTrackingParameters),
      externalCalls: false,
    },
    provider,
    providerError,
  };
}
