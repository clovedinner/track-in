import {
  parseProviderId,
  validateProviderConfiguration,
  type ProviderConfiguration,
  type ProviderId,
} from "@/lib/providers/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TrafficSourceInputError extends Error {
  public constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "TrafficSourceInputError";
  }
}

export type TrafficSourceInput = {
  name: string;
  type: ProviderId;
  enabled: boolean;
  credentialSecretRef?: string;
  configuration: ProviderConfiguration;
  retryPolicy: Record<string, unknown>;
};

export function postbackEventConversionIds(configuration: ProviderConfiguration): string[] {
  return configuration.postbackMode === "per_event"
    ? (configuration.eventPostbacks ?? []).map((entry) => entry.customConversionId)
    : [];
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new TrafficSourceInputError(field, `${field} must be a string.`);
  const result = value.trim();
  if (result.length === 0 || result.length > maxLength) {
    throw new TrafficSourceInputError(field, `${field} must be between 1 and ${maxLength} characters.`);
  }
  return result;
}

function parseRetryPolicy(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TrafficSourceInputError("retryPolicy", "retryPolicy must be an object.");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 10) throw new TrafficSourceInputError("retryPolicy", "retryPolicy has too many entries.");
  const allowed = new Set(["maxAttempts", "baseDelaySeconds", "maxDelaySeconds"]);
  for (const [key, candidate] of entries) {
    if (!allowed.has(key)) throw new TrafficSourceInputError("retryPolicy", `Unsupported retry policy key: ${key}.`);
    if (typeof candidate !== "number" || !Number.isInteger(candidate) || candidate < 1 || candidate > 86_400) {
      throw new TrafficSourceInputError("retryPolicy", `${key} must be a positive integer within range.`);
    }
  }
  return Object.fromEntries(entries);
}

export function parseTrafficSourceInput(body: unknown): TrafficSourceInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new TrafficSourceInputError("body", "Request body must be a JSON object.");
  }
  const input = body as Record<string, unknown>;
  const name = requiredString(input.name, "name", 200);
  let type: ProviderId;
  try {
    type = parseProviderId(input.type ?? "generic");
  } catch (error) {
    throw new TrafficSourceInputError("type", error instanceof Error ? error.message : "Unsupported provider type.");
  }

  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    throw new TrafficSourceInputError("enabled", "enabled must be a boolean.");
  }

  let credentialSecretRef: string | undefined;
  if (input.credentialSecretRef !== undefined && input.credentialSecretRef !== null) {
    credentialSecretRef = requiredString(input.credentialSecretRef, "credentialSecretRef", 256);
  }

  let configuration: ProviderConfiguration;
  try {
    configuration = validateProviderConfiguration(type, input.configuration ?? {});
  } catch (error) {
    throw new TrafficSourceInputError(
      "configuration",
      error instanceof Error ? error.message : "Invalid provider configuration.",
    );
  }

  return {
    name,
    type,
    enabled: input.enabled === undefined ? true : input.enabled,
    credentialSecretRef,
    configuration,
    retryPolicy: parseRetryPolicy(input.retryPolicy),
  };
}

/** Safe API representation. Configuration values that can carry credentials are omitted. */
export function safeTrafficSourceConfiguration(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const safe: Record<string, unknown> = {};
  const secretKeys = new Set(["key", "token", "secret", "password", "authorization", "apiKey", "api_key"]);
  const safeUrl = (candidate: string): string => {
    try {
      const url = new URL(candidate);
      for (const secret of ["key", "token", "secret", "api_key", "apiKey", "a", "member_id"]) {
        if (url.searchParams.has(secret)) url.searchParams.set(secret, "[redacted]");
      }
      return url.toString().replace(/%7B/gi, "{").replace(/%7D/gi, "}");
    } catch {
      return "[redacted]";
    }
  };
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeys.has(key.toLowerCase())) continue;
    if (key === "postbackUrl" || key === "endpoint") {
      if (typeof candidate === "string") safe[key] = safeUrl(candidate);
      continue;
    }
    if (key === "eventPostbacks" && Array.isArray(candidate)) {
      safe[key] = candidate.map((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return {};
        const mapping = entry as Record<string, unknown>;
        return {
          customConversionId: mapping.customConversionId,
          ...(typeof mapping.url === "string" ? { url: safeUrl(mapping.url) } : {}),
        };
      });
      continue;
    }
    safe[key] = candidate;
  }
  return safe;
}

export function parseTrafficSourceId(value: string): string {
  if (!uuidPattern.test(value)) throw new TrafficSourceInputError("id", "id must be a valid UUID.");
  return value;
}

/** Keep masked URL credentials on the server when an existing source is edited. */
export function preserveMaskedPostbackValues(next: ProviderConfiguration, previous: unknown): ProviderConfiguration {
  const saved = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as ProviderConfiguration : {};
  const restore = (candidate: string | undefined, original: string | undefined): string | undefined => {
    if (!candidate) return candidate;
    const url = new URL(candidate);
    const hasMask = [...url.searchParams.values()].includes("[redacted]");
    if (!hasMask) return candidate;
    const old = original ? new URL(original) : undefined;
    if (!old || old.origin !== url.origin || old.pathname !== url.pathname) throw new TrafficSourceInputError("configuration", "Enter real credentials when changing a masked postback endpoint.");
    const restored = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      const originalValue = old.searchParams.get(key);
      if (value === "[redacted]" && (!originalValue || originalValue === "[redacted]")) throw new TrafficSourceInputError("configuration", "Replace masked credentials with a valid value.");
      restored.append(key, value === "[redacted]" ? originalValue! : value);
    }
    url.search = restored.toString();
    return url.toString().replace(/%7b/gi, "{").replace(/%7d/gi, "}");
  };
  return {
    ...next,
    postbackUrl: restore(next.postbackUrl, saved.postbackUrl),
    eventPostbacks: next.eventPostbacks?.map((entry) => ({ ...entry, url: restore(entry.url, saved.eventPostbacks?.find((old) => old.customConversionId === entry.customConversionId)?.url)! })),
    postbackByEventType: next.postbackByEventType && Object.fromEntries(Object.entries(next.postbackByEventType).map(([event, url]) => [event, restore(url, saved.postbackByEventType?.[event])!])),
  };
}
