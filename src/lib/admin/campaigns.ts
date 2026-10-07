import { CampaignStatus } from "../../generated/prisma/client";

const campaignSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trackingParameterPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const campaignStatuses = new Set<string>(Object.values(CampaignStatus));

export type CreateCampaignInput = {
  slug: string;
  name: string;
  destinationUrl: string;
  status: CampaignStatus;
  defaultCurrency: string;
  trafficSourceId?: string;
  offerId?: string;
  allowedTrackingParameters: string[];
};

export class CampaignInputError extends Error {
  public constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "CampaignInputError";
  }
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new CampaignInputError(field, `${field} must be a string.`);
  }

  const result = value.trim();
  if (result.length === 0 || result.length > maxLength) {
    throw new CampaignInputError(field, `${field} must be between 1 and ${maxLength} characters.`);
  }

  return result;
}

function parseDestinationUrl(value: unknown): string {
  const destinationUrl = requireString(value, "destinationUrl", 2_048);
  let parsed: URL;

  try {
    parsed = new URL(destinationUrl);
  } catch {
    throw new CampaignInputError("destinationUrl", "destinationUrl must be an absolute HTTPS URL.");
  }

  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    throw new CampaignInputError("destinationUrl", "destinationUrl must be an absolute HTTPS URL.");
  }

  return parsed.toString();
}

function parseAllowedTrackingParameters(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new CampaignInputError(
      "allowedTrackingParameters",
      "allowedTrackingParameters must be an array of at most 20 names.",
    );
  }

  const parameters = value.map((candidate) => {
    if (typeof candidate !== "string" || !trackingParameterPattern.test(candidate)) {
      throw new CampaignInputError(
        "allowedTrackingParameters",
        "Each tracking parameter must be a safe query-parameter name.",
      );
    }

    if (candidate.toLowerCase() === "cid") {
      throw new CampaignInputError("allowedTrackingParameters", "cid is reserved for the tracker click ID.");
    }

    return candidate;
  });

  if (new Set(parameters).size !== parameters.length) {
    throw new CampaignInputError("allowedTrackingParameters", "Tracking parameters must be unique.");
  }

  return parameters;
}

export function parseCreateCampaignInput(body: unknown): CreateCampaignInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new CampaignInputError("body", "Request body must be a JSON object.");
  }

  const input = body as Record<string, unknown>;
  const slug = requireString(input.slug, "slug", 100);
  if (!campaignSlugPattern.test(slug)) {
    throw new CampaignInputError("slug", "slug must use lowercase letters, numbers, and hyphens.");
  }

  const name = requireString(input.name, "name", 200);
  const statusValue = input.status === undefined ? CampaignStatus.paused : input.status;
  if (typeof statusValue !== "string" || !campaignStatuses.has(statusValue)) {
    throw new CampaignInputError("status", "status must be active, paused, or archived.");
  }

  const defaultCurrency = requireString(input.defaultCurrency, "defaultCurrency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    throw new CampaignInputError("defaultCurrency", "defaultCurrency must be a three-letter ISO currency code.");
  }

  let trafficSourceId: string | undefined;
  if (input.trafficSourceId !== undefined && input.trafficSourceId !== null) {
    trafficSourceId = requireString(input.trafficSourceId, "trafficSourceId", 36);
    if (!uuidPattern.test(trafficSourceId)) {
      throw new CampaignInputError("trafficSourceId", "trafficSourceId must be a valid UUID.");
    }
  }

  let offerId: string | undefined;
  if (input.offerId !== undefined && input.offerId !== null && input.offerId !== "") {
    offerId = requireString(input.offerId, "offerId", 36);
    if (!uuidPattern.test(offerId)) throw new CampaignInputError("offerId", "offerId must be a valid UUID.");
  }

  return {
    slug,
    name,
    destinationUrl: parseDestinationUrl(input.destinationUrl),
    status: statusValue as CampaignStatus,
    defaultCurrency,
    trafficSourceId,
    offerId,
    allowedTrackingParameters: parseAllowedTrackingParameters(input.allowedTrackingParameters ?? []),
  };
}
