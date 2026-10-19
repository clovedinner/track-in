import { buildCampaignTrackingUrl, buildDirectCampaignUrl, getTrackingUrlDefinition } from "@/lib/tracking/campaign-url";
import { generateDefaultGtmSnippets } from "@/lib/setup/gtm-snippets";
import { parseProviderId, validateProviderConfiguration, type ProviderId } from "@/lib/providers/config";

export type CampaignSetupInput = {
  id: string;
  slug: string;
  name: string;
  status: string;
  trackingMode?: string;
  destinationUrl: string;
  offerId?: string | null;
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
  trackingMode: string;
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
  const trackingMode = input.trackingMode ?? "redirect";
  const allowedTrackingParameters = asStringArray(input.allowedTrackingParameters);
  const provider = safeProvider(input.trafficSource?.type);
  let trackingUrls: Partial<Record<ProviderId, string>> = {};
  let trackingError: string | null = null;
  if (provider) {
    try {
      const configuration = input.trafficSource?.configuration;
      if (trackingMode === "direct") {
        const offerUrl = input.destinationUrl;
        const record = configuration && typeof configuration === "object" && !Array.isArray(configuration) ? configuration as Record<string, unknown> : {};
        const externalId = record.externalId && typeof record.externalId === "object" && !Array.isArray(record.externalId) ? record.externalId as { parameter?: string; token?: string; enabled?: boolean } : undefined;
        const cost = record.cost && typeof record.cost === "object" && !Array.isArray(record.cost) ? record.cost as { parameter?: string; token?: string; enabled?: boolean } : undefined;
        const parameters = Array.isArray(record.parameters) ? record.parameters as Array<{ parameter?: string; token?: string; enabled?: boolean }> : [];
        trackingUrls = { [provider]: buildDirectCampaignUrl({ offerUrl, campaignId: input.id, offerId: input.offerId ?? undefined, externalId, cost, parameters }) };
      } else {
        const configuration = input.trafficSource?.configuration;
        const record = configuration && typeof configuration === "object" && !Array.isArray(configuration) ? configuration as Record<string, unknown> : {};
        const cost = record.cost && typeof record.cost === "object" && !Array.isArray(record.cost) ? record.cost as { parameter?: string; token?: string; enabled?: boolean } : undefined;
        const additionalParameters = cost?.enabled !== false && cost?.parameter && cost?.token ? { [cost.parameter]: cost.token } : {};
        const trackingParameters = [...allowedTrackingParameters];
        const providerTokenParameter = getTrackingUrlDefinition(provider).tokenParameter;
        if (!trackingParameters.some((name) => name.toLowerCase() === providerTokenParameter.toLowerCase())) trackingParameters.push(providerTokenParameter);
        if (Object.keys(additionalParameters).length > 0) trackingParameters.push(...Object.keys(additionalParameters).filter((name) => !trackingParameters.includes(name)));
        trackingUrls = { [provider]: buildCampaignTrackingUrl({ trackerBaseUrl: baseUrl, campaignSlug: input.slug, provider, allowedTrackingParameters: trackingParameters, additionalParameters }) };
      }
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
    trackingMode,
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
