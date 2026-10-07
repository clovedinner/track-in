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
  key?: string;
  allowDuplicates?: boolean;
  goalId?: string;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
};

export type PropellerProviderConfiguration = {
  postbackUrl: string;
  aid?: string;
  pid?: string;
  tid?: string;
  goalByEventType?: Record<string, number | undefined>;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
};

export type TrafficJunkyProviderConfiguration = {
  postbackUrl: string;
  descriptionByEventType?: Record<string, string | undefined>;
  parameters?: Array<{ name: string; parameter?: string; token: string; enabled?: boolean }>;
  costCurrency?: "USD";
  postbackByEventType?: Record<string, string>;
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
  return { parameters: optionalParameters(record), costCurrency: costCurrency as "USD" | undefined, postbackByEventType: optionalEventPostbacks(record) };
}

function validateTrafficStarsConfiguration(value: unknown): TrafficStarsProviderConfiguration {
  if (!isRecord(value)) throw new Error("TrafficStars configuration must be an object.");
  const postbackUrl = optionalString(value, "postbackUrl");
  const endpoint = optionalString(value, "endpoint");
  if (postbackUrl === undefined && endpoint === undefined) {
    throw new Error("TrafficStars configuration requires postbackUrl or endpoint.");
  }
  const destination = postbackUrl ?? endpoint;
  if (destination !== undefined) validateUrl(destination, postbackUrl === undefined ? "endpoint" : "postbackUrl");
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
  const postbackUrl = validateUrl(requiredString(value, "postbackUrl"), "postbackUrl");
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
  const postbackUrl = validateUrl(requiredString(value, "postbackUrl"), "postbackUrl");
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
