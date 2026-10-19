import { randomBytes } from "node:crypto";

const reservedParameter = "cid";

type TrafficSourceConfiguration = {
  externalId?: { parameter?: unknown; enabled?: unknown };
  parameters?: Array<{ parameter?: unknown; enabled?: unknown }>;
};

/** Return the traffic-source parameters enabled for click attribution. */
export function enabledTrafficSourceParameters(configuration: unknown): string[] {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return [];
  const record = configuration as TrafficSourceConfiguration;
  const parameters: string[] = [];
  if (record.externalId?.enabled !== false && typeof record.externalId?.parameter === "string" && record.externalId.parameter.trim()) {
    parameters.push(record.externalId.parameter.trim());
  }
  if (Array.isArray(record.parameters)) {
    for (const entry of record.parameters) {
      if (entry?.enabled === false || typeof entry?.parameter !== "string" || !entry.parameter.trim()) continue;
      parameters.push(entry.parameter.trim());
    }
  }
  return [...new Set(parameters)];
}

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
    if (typeof candidate !== "string" || candidate.trim().toLowerCase() === reservedParameter) {
      continue;
    }

    const exactValue = searchParams.get(candidate);
    const value = exactValue ?? [...searchParams.entries()].find(([name]) => name.toLowerCase() === candidate.toLowerCase())?.[1] ?? null;
    if (value !== null && value.length > 0 && value.length <= 512) {
      tokens[candidate.trim()] = value;
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
