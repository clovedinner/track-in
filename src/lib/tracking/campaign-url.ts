import type { ProviderId } from "@/lib/providers/config";

/**
 * The macros are the values the traffic source expands before the click
 * reaches Track.in. They are deliberately kept separate from Track.in's
 * internal `cid`, which is created by the redirect endpoint.
 */
export type TrackingUrlDefinition = {
  provider: ProviderId;
  tokenParameter: string;
  tokenMacro: string;
  label: string;
};

export type BuildCampaignTrackingUrlInput = {
  trackerBaseUrl: string;
  campaignSlug: string;
  provider: ProviderId;
  /** Names configured on the campaign and permitted to receive source macros. */
  allowedTrackingParameters?: readonly string[];
  /** Optional source macros for configured, allowlisted parameters. */
  additionalParameters?: Readonly<Record<string, string>>;
};

const definitions: Record<ProviderId, TrackingUrlDefinition> = {
  trafficstars: {
    provider: "trafficstars",
    label: "TrafficStars",
    tokenParameter: "clickid",
    tokenMacro: "{click_id}",
  },
  propeller: {
    provider: "propeller",
    label: "PropellerAds",
    tokenParameter: "subid",
    tokenMacro: "${SUBID}",
  },
  trafficjunky: {
    provider: "trafficjunky",
    label: "TrafficJunky",
    tokenParameter: "ACLID",
    tokenMacro: "{ACLID}",
  },
};

const parameterNamePattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getTrackingUrlDefinition(provider: ProviderId): TrackingUrlDefinition {
  return definitions[provider];
}

function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("trackerBaseUrl must be an absolute HTTP or HTTPS URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("trackerBaseUrl must use HTTP or HTTPS.");
  }

  // A base URL may have a deployment path, but query strings and fragments
  // would make the generated tracking endpoint ambiguous.
  if (url.search || url.hash) {
    throw new Error("trackerBaseUrl must not include a query string or fragment.");
  }

  return url;
}

function validateParameterName(name: string): void {
  if (!parameterNamePattern.test(name) || name.toLowerCase() === "cid") {
    throw new Error(`Invalid tracking parameter name: ${name}`);
  }
}

function validateMacro(value: string, name: string): void {
  if (value.length === 0 || value.length > 512) {
    throw new Error(`Tracking parameter ${name} must be a non-empty value no longer than 512 characters.`);
  }
}

/**
 * Build the URL an operator pastes into an ad platform campaign.
 *
 * The provider token is always included. Additional values are only included
 * when their names appear in the campaign allowlist, preventing the setup UI
 * from accidentally turning this helper into an arbitrary query-string proxy.
 */
export function buildCampaignTrackingUrl(input: BuildCampaignTrackingUrlInput): string {
  const definition = getTrackingUrlDefinition(input.provider);
  const baseUrl = parseBaseUrl(input.trackerBaseUrl);
  const slug = input.campaignSlug.trim();
  if (!slugPattern.test(slug)) {
    throw new Error("campaignSlug must use lowercase letters, numbers, and hyphens.");
  }

  const allowed = new Set<string>();
  for (const name of input.allowedTrackingParameters ?? []) {
    validateParameterName(name);
    if (allowed.has(name)) throw new Error(`Duplicate tracking parameter: ${name}`);
    allowed.add(name);
  }

  const tokenNameIsAllowed = [...allowed].some((name) => name.toLowerCase() === definition.tokenParameter.toLowerCase());
  if (allowed.size > 0 && !tokenNameIsAllowed) {
    throw new Error(`Campaign allowlist must include the provider token parameter ${definition.tokenParameter}.`);
  }

  const additional = input.additionalParameters ?? {};
  for (const [name, value] of Object.entries(additional)) {
    validateParameterName(name);
    if (!allowed.has(name)) {
      throw new Error(`Tracking parameter ${name} is not in the campaign allowlist.`);
    }
    validateMacro(value, name);
  }

  const endpoint = new URL(`/t/${encodeURIComponent(slug)}`, baseUrl);
  endpoint.searchParams.set(definition.tokenParameter, definition.tokenMacro);
  for (const [name, value] of Object.entries(additional)) endpoint.searchParams.set(name, value);
  return endpoint.toString();
}

export function buildAllCampaignTrackingUrls(
  input: Omit<BuildCampaignTrackingUrlInput, "provider">,
): Record<ProviderId, string> {
  return {
    trafficstars: buildCampaignTrackingUrl({ ...input, provider: "trafficstars" }),
    propeller: buildCampaignTrackingUrl({ ...input, provider: "propeller" }),
    trafficjunky: buildCampaignTrackingUrl({ ...input, provider: "trafficjunky" }),
  };
}
