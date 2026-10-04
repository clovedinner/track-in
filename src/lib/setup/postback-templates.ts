import {
  getProviderDefinition,
  parseProviderId,
  validateProviderConfiguration,
  type ProviderConfiguration,
  type ProviderId,
  type TrafficStarsProviderConfiguration,
} from "@/lib/providers/config";

/**
 * A safe, copyable representation of a provider postback URL.
 *
 * The saved provider URL is used as the base so provider-specific account
 * parameters are retained. Credential-bearing values are always replaced in
 * the returned URL; this module must never be used to render raw secrets.
 */
export type ProviderPostbackTemplate = {
  provider: ProviderId;
  label: string;
  method: "GET";
  url: string;
  /** Names and example placeholders the operator should keep in the provider UI. */
  placeholders: Readonly<Record<string, string>>;
  /** Query keys that were redacted from the saved configuration. */
  redactedKeys: readonly string[];
};

type TemplateDefinition = {
  placeholders: Readonly<Record<string, string>>;
  dynamicParameters: Readonly<Record<string, string>>;
};

const DEFINITIONS: Record<ProviderId, TemplateDefinition> = {
  trafficstars: {
    placeholders: {
      clickid: "{click_id}",
      lead_code: "{event_id}",
      value: "{payout}",
      goalid: "{goalid}",
    },
    dynamicParameters: {
      clickid: "{click_id}",
      lead_code: "{event_id}",
      value: "{payout}",
    },
  },
  propeller: {
    placeholders: {
      visitor_id: "${SUBID}",
      goal: "{goal}",
      payout: "{payout}",
    },
    dynamicParameters: {
      visitor_id: "${SUBID}",
      goal: "{goal}",
      payout: "{payout}",
    },
  },
  trafficjunky: {
    placeholders: {
      aclid: "{ACLID}",
      cti: "{TRANSACTION_UNIQ_ID}",
      ctv: "{VALUE_OF_THE_TRANSACTION}",
      ctd: "{TRANSACTION_DESCRIPTION}",
    },
    dynamicParameters: {
      aclid: "{ACLID}",
      cti: "{TRANSACTION_UNIQ_ID}",
      ctv: "{VALUE_OF_THE_TRANSACTION}",
      ctd: "{TRANSACTION_DESCRIPTION}",
    },
  },
};

const SECRET_QUERY_KEYS = new Set([
  "a",
  "api_key",
  "apikey",
  "authorization",
  "key",
  "member_id",
  "password",
  "secret",
  "token",
]);

function endpointFromConfiguration(configuration: ProviderConfiguration): string {
  const candidate = "postbackUrl" in configuration
    ? (configuration.postbackUrl ?? ("endpoint" in configuration ? configuration.endpoint : undefined))
    : configuration.endpoint;
  if (typeof candidate !== "string") throw new Error("Provider postback URL is required.");
  return candidate;
}

function safeEndpoint(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Provider postback URL must be a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Provider postback URL must use HTTP or HTTPS.");
  }
  return url;
}

function isCredentialField(provider: ProviderId, key: string): boolean {
  void provider;
  return SECRET_QUERY_KEYS.has(key.toLowerCase());
}

/**
 * Generate one provider template from saved configuration.
 *
 * Existing query values are preserved, including provider macros. Missing
 * conversion fields receive documented placeholders. URLSearchParams safely
 * encodes static values while retaining placeholders when read back by the
 * provider or operator.
 */
export function generateProviderPostbackTemplate(
  providerInput: unknown,
  savedConfiguration: unknown,
): ProviderPostbackTemplate {
  const provider = parseProviderId(providerInput);
  const configuration = validateProviderConfiguration(provider, savedConfiguration);
  const url = safeEndpoint(endpointFromConfiguration(configuration));
  const definition = DEFINITIONS[provider];
  const redactedKeys = new Set<string>();

  for (const key of [...url.searchParams.keys()]) {
    if (isCredentialField(provider, key)) {
      url.searchParams.set(key, "[redacted]");
      redactedKeys.add(key);
    }
  }

  if (provider === "trafficstars" && (configuration as TrafficStarsProviderConfiguration).key !== undefined) {
    url.searchParams.set("key", "[redacted]");
    redactedKeys.add("key");
  }

  for (const [key, placeholder] of Object.entries(definition.dynamicParameters)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, placeholder);
  }

  return {
    provider,
    label: getProviderDefinition(provider).label,
    method: "GET",
    url: url.toString(),
    placeholders: definition.placeholders,
    redactedKeys: [...redactedKeys].sort(),
  };
}

export function generateProviderPostbackTemplates(
  configurations: Partial<Record<ProviderId, unknown>>,
): Record<ProviderId, ProviderPostbackTemplate | undefined> {
  return {
    trafficstars: configurations.trafficstars === undefined
      ? undefined
      : generateProviderPostbackTemplate("trafficstars", configurations.trafficstars),
    propeller: configurations.propeller === undefined
      ? undefined
      : generateProviderPostbackTemplate("propeller", configurations.propeller),
    trafficjunky: configurations.trafficjunky === undefined
      ? undefined
      : generateProviderPostbackTemplate("trafficjunky", configurations.trafficjunky),
  };
}
