/**
 * Shared provider identifiers and configuration validation.
 *
 * Provider credentials and generated postback URLs are intentionally never
 * returned from the logging helper in this module. Callers can use the typed
 * configuration with an adapter, but should pass only safeProviderLogContext
 * to logs.
 */

export const SUPPORTED_PROVIDER_IDS = ["trafficstars", "propeller", "trafficjunky"] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];

export type TrafficStarsProviderConfiguration = {
  postbackUrl?: string;
  endpoint?: string;
  postbackMode?: "single" | "per_event";
  eventPostbacks?: Array<{ customConversionId: string; url: string }>;
  key?: string;
  allowDuplicates?: boolean;
  goalId?: string;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
  externalId?: { parameter: string; token: string; enabled?: boolean };
};

export type PropellerProviderConfiguration = {
  postbackUrl?: string;
  postbackMode?: "single" | "per_event";
  eventPostbacks?: Array<{ customConversionId: string; url: string }>;
  aid?: string;
  pid?: string;
  tid?: string;
  goalByEventType?: Record<string, number | undefined>;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
  externalId?: { parameter: string; token: string; enabled?: boolean };
};

export type TrafficJunkyProviderConfiguration = {
  postbackUrl?: string;
  postbackMode?: "single" | "per_event";
  eventPostbacks?: Array<{ customConversionId: string; url: string }>;
  descriptionByEventType?: Record<string, string | undefined>;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
  externalId?: { parameter: string; token: string; enabled?: boolean };
};

export type ProviderConfiguration =
  | TrafficStarsProviderConfiguration
  | PropellerProviderConfiguration
  | TrafficJunkyProviderConfiguration;

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  requiredOriginalTokenKeys: readonly string[];
};

const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  trafficstars: {
    id: "trafficstars",
    label: "TrafficStars",
    requiredOriginalTokenKeys: ["clickid", "click_id", "CLICKID"],
  },
  propeller: {
    id: "propeller",
    label: "PropellerAds",
    requiredOriginalTokenKeys: ["subid", "SUBID", "clickid", "CLICKID"],
  },
  trafficjunky: {
    id: "trafficjunky",
    label: "TrafficJunky",
    requiredOriginalTokenKeys: ["ACLID", "aclid", "clickid", "click_id"],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 2_048) {
    throw new Error(`${key} must be a non-empty string no longer than 2048 characters.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 2_048) {
    throw new Error(`${key} must be a non-empty string no longer than 2048 characters.`);
  }
  return value.trim();
}

function validateUrl(value: string, key: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${key} must use HTTP or HTTPS.`);
  }
  return value;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalPostbackConfiguration(record: Record<string, unknown>): {
  postbackMode?: "single" | "per_event";
  eventPostbacks?: Array<{ customConversionId: string; url: string }>;
} {
  const rawMode = record.postbackMode;
  if (rawMode !== undefined && rawMode !== "single" && rawMode !== "per_event") {
    throw new Error("postbackMode must be single or per_event.");
  }
  const postbackMode = rawMode as "single" | "per_event" | undefined;
  const rawMappings = record.eventPostbacks;
  if (rawMappings === undefined) return { postbackMode };
  if (!Array.isArray(rawMappings) || rawMappings.length > 10) {
    throw new Error("eventPostbacks must contain at most 10 entries.");
  }
  const seen = new Set<string>();
  const eventPostbacks = rawMappings.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`eventPostbacks[${index}] must be an object.`);
    const customConversionId = requiredString(entry, "customConversionId");
    if (!uuidPattern.test(customConversionId)) throw new Error(`eventPostbacks[${index}].customConversionId must be a UUID.`);
    if (seen.has(customConversionId)) throw new Error("Each custom conversion can only have one postback URL.");
    seen.add(customConversionId);
    const url = validateUrl(requiredString(entry, "url"), `eventPostbacks[${index}].url`);
    return { customConversionId, url };
  });
  return { postbackMode, eventPostbacks };
}

function validatePostbackMode(mode: "single" | "per_event" | undefined, eventPostbacks: Array<{ customConversionId: string; url: string }> | undefined, destination: string | undefined): void {
  if (mode === "per_event") {
    if (eventPostbacks === undefined || eventPostbacks.length === 0) throw new Error("At least one event postback URL is required when per-event mode is selected.");
    return;
  }
  if (eventPostbacks !== undefined && eventPostbacks.length > 0) {
    throw new Error("Event postback URLs can only be used in per-event mode.");
  }
  if (destination === undefined) throw new Error("postbackUrl is required when single postback mode is selected.");
}

function optionalStringRecord(record: Record<string, unknown>, key: string): Record<string, string | undefined> | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${key} must be an object.`);
  const result: Record<string, string | undefined> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.trim().length === 0 || entryKey.length > 100) throw new Error(`${key} contains an invalid key.`);
    if (entryValue !== undefined && (typeof entryValue !== "string" || entryValue.trim().length === 0 || entryValue.length > 256)) {
      throw new Error(`${key}.${entryKey} must be a non-empty string no longer than 256 characters.`);
    }
    result[entryKey] = typeof entryValue === "string" ? entryValue.trim() : undefined;
  }
  return result;
}

function optionalEventPostbacks(record: Record<string, unknown>): Record<string, string> | undefined {
  const value = record.postbackByEventType;
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("postbackByEventType must be an object.");
  const result: Record<string, string> = {};
  for (const [eventType, url] of Object.entries(value)) {
    if (!/^[a-z0-9_-]{1,50}$/i.test(eventType)) throw new Error("postbackByEventType contains an invalid event type.");
    result[eventType] = validateUrl(requiredString({ url }, "url"), `postbackByEventType.${eventType}`);
  }
  return result;
}

function optionalExternalId(record: Record<string, unknown>): { parameter: string; token: string; enabled?: boolean } | undefined {
  const value = record.externalId;
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("externalId must be an object.");
  const parameter = requiredString(value, "parameter");
  const token = requiredString(value, "token");
  const enabled = value.enabled === undefined ? true : value.enabled;
  if (typeof enabled !== "boolean") throw new Error("externalId.enabled must be a boolean.");
  return { parameter, token, enabled };
}

function optionalParameters(record: Record<string, unknown>): Array<{ name: string; parameter?: string; token: string; enabled?: boolean }> | undefined {
  const value = record.parameters;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 10) throw new Error("parameters must contain at most 10 entries.");
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`parameters[${index}] must be an object.`);
    const name = requiredString(entry, "name");
    const parameter = entry.parameter === undefined ? undefined : requiredString(entry, "parameter");
    const token = requiredString(entry, "token");
    const enabled = entry.enabled === undefined ? true : entry.enabled;
    if (typeof enabled !== "boolean") throw new Error(`parameters[${index}].enabled must be a boolean.`);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(name)) throw new Error(`parameters[${index}].name is invalid.`);
    return { name, parameter, token, enabled };
  });
}

function optionalCommonConfiguration(record: Record<string, unknown>) {
  const costCurrency = record.costCurrency === undefined ? undefined : record.costCurrency;
  if (costCurrency !== undefined && costCurrency !== "USD") throw new Error("costCurrency must be USD.");
  return { parameters: optionalParameters(record), costCurrency: costCurrency as "USD" | undefined, postbackByEventType: optionalEventPostbacks(record), externalId: optionalExternalId(record), ...optionalPostbackConfiguration(record) };
}

function validateTrafficStarsConfiguration(value: unknown): TrafficStarsProviderConfiguration {
  if (!isRecord(value)) throw new Error("TrafficStars configuration must be an object.");
  const postbackUrl = optionalString(value, "postbackUrl");
  const endpoint = optionalString(value, "endpoint");
  const destination = postbackUrl ?? endpoint;
  if (destination !== undefined) validateUrl(destination, postbackUrl === undefined ? "endpoint" : "postbackUrl");
  const postback = optionalPostbackConfiguration(value);
  validatePostbackMode(postback.postbackMode, postback.eventPostbacks, destination);
  const key = optionalString(value, "key");
  const goalId = optionalString(value, "goalId");
  const allowDuplicates = value.allowDuplicates;
  if (allowDuplicates !== undefined && typeof allowDuplicates !== "boolean") {
    throw new Error("allowDuplicates must be a boolean.");
  }
  return { postbackUrl, endpoint, key, goalId, allowDuplicates, ...optionalCommonConfiguration(value) };
}

function validatePropellerConfiguration(value: unknown): PropellerProviderConfiguration {
  if (!isRecord(value)) throw new Error("PropellerAds configuration must be an object.");
  const postbackUrl = optionalString(value, "postbackUrl");
  if (postbackUrl !== undefined) validateUrl(postbackUrl, "postbackUrl");
  const postback = optionalPostbackConfiguration(value);
  validatePostbackMode(postback.postbackMode, postback.eventPostbacks, postbackUrl);
  const aid = optionalString(value, "aid");
  const pid = optionalString(value, "pid");
  const tid = optionalString(value, "tid");
  const rawGoals = value.goalByEventType;
  let goalByEventType: Record<string, number | undefined> | undefined;
  if (rawGoals !== undefined) {
    if (!isRecord(rawGoals)) throw new Error("goalByEventType must be an object.");
    goalByEventType = {};
    for (const [eventType, goal] of Object.entries(rawGoals)) {
      if (typeof goal !== "number" || !Number.isInteger(goal) || goal < 1 || goal > 100) {
        throw new Error(`goalByEventType.${eventType} must be an integer between 1 and 100.`);
      }
      goalByEventType[eventType] = goal;
    }
  }
  return { postbackUrl, aid, pid, tid, goalByEventType, ...optionalCommonConfiguration(value) };
}

function validateTrafficJunkyConfiguration(value: unknown): TrafficJunkyProviderConfiguration {
  if (!isRecord(value)) throw new Error("TrafficJunky configuration must be an object.");
  const postbackUrl = optionalString(value, "postbackUrl");
  if (postbackUrl !== undefined) validateUrl(postbackUrl, "postbackUrl");
  const postback = optionalPostbackConfiguration(value);
  validatePostbackMode(postback.postbackMode, postback.eventPostbacks, postbackUrl);
  return {
    postbackUrl,
    descriptionByEventType: optionalStringRecord(value, "descriptionByEventType"),
    ...optionalCommonConfiguration(value),
  };
}

export function parseProviderId(value: unknown): ProviderId {
  if (typeof value !== "string") throw new Error("Provider type must be a supported string.");
  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_PROVIDER_IDS.includes(normalized as ProviderId)) {
    throw new Error(`Unsupported provider type: ${normalized || "empty"}.`);
  }
  return normalized as ProviderId;
}

export function getProviderDefinition(providerId: unknown): ProviderDefinition {
  return PROVIDER_DEFINITIONS[parseProviderId(providerId)];
}

export function validateProviderConfiguration(providerId: unknown, value: unknown): ProviderConfiguration {
  switch (parseProviderId(providerId)) {
    case "trafficstars":
      return validateTrafficStarsConfiguration(value);
    case "propeller":
      return validatePropellerConfiguration(value);
    case "trafficjunky":
      return validateTrafficJunkyConfiguration(value);
  }
}

/** Safe metadata for logs. Never include provider configuration or credentials. */
export function safeProviderLogContext(providerId: unknown): { provider: ProviderId } {
  return { provider: parseProviderId(providerId) };
}
