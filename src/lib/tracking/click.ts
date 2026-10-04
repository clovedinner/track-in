import { randomBytes } from "node:crypto";

const reservedParameter = "cid";

export function createClickId(): string {
  return randomBytes(18).toString("base64url");
}

export function collectTrackingTokens(
  searchParams: URLSearchParams,
  allowedParameters: unknown,
): Record<string, string> {
  if (!Array.isArray(allowedParameters)) {
    return {};
  }

  const tokens: Record<string, string> = {};

  for (const candidate of allowedParameters) {
    if (typeof candidate !== "string" || candidate === reservedParameter) {
      continue;
    }

    const value = searchParams.get(candidate);
    if (value !== null && value.length > 0 && value.length <= 512) {
      tokens[candidate] = value;
    }
  }

  return tokens;
}

export function buildTrackingDestination(
  destinationUrl: string,
  clickId: string,
  trackingTokens: Record<string, string>,
): URL {
  const destination = new URL(destinationUrl);

  if (!['http:', 'https:'].includes(destination.protocol)) {
    throw new Error("Campaign destination must use HTTP or HTTPS.");
  }

  destination.searchParams.set(reservedParameter, clickId);

  for (const [key, value] of Object.entries(trackingTokens)) {
    destination.searchParams.set(key, value);
  }

  return destination;
}
