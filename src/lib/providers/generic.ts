import type { GenericProviderConfiguration } from "@/lib/providers/config";

export const GENERIC_POSTBACK_TOKENS = [
  "{externalid}", "{clickid}", "{event.id}", "{event.type}", "{transaction.id}",
  "{payout}", "{payout.currency}", "{payout.minor}", "{cost}",
  ...Array.from({ length: 10 }, (_, index) => `{var${index + 1}}`),
] as const;

export type GenericPostbackConversion = {
  eventId: string;
  eventType: string;
  valueMinor: bigint;
  currency: string;
  clickId?: string;
  transactionReference?: string | null;
};

type Resolver = () => string;
const placeholderPattern = /\$?\{([^{}]+)\}/g;
const normalizedPlaceholder = (value: string) => value.replace(/^\$/, "").toLowerCase();

function capturedValue(tokens: Record<string, unknown>, parameter: string | undefined): string {
  if (!parameter) throw new Error("Postback token has no enabled incoming parameter mapping.");
  const value = tokens[parameter] ?? Object.entries(tokens).find(([key]) => key.toLowerCase() === parameter.toLowerCase())?.[1];
  if (typeof value !== "string" || !value.trim() || value.length > 512 || /^\$?\{.*\}$/.test(value.trim())) {
    throw new Error(`Postback requires a captured value for parameter "${parameter}".`);
  }
  return value;
}

function payout(valueMinor: bigint, currency: string): string {
  const exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  if (exponent === 0) return valueMinor.toString();
  const negative = valueMinor < BigInt(0);
  const digits = (negative ? -valueMinor : valueMinor).toString().padStart(exponent + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

function tokenResolvers(configuration: GenericProviderConfiguration, tokens: Record<string, unknown>, conversion?: GenericPostbackConversion): Map<string, Resolver> {
  const event = () => {
    if (!conversion) throw new Error("Conversion context is required for this postback token.");
    return conversion;
  };
  const externalId = () => capturedValue(tokens, configuration.externalId?.enabled !== false ? configuration.externalId?.parameter : undefined);
  const resolvers: Map<string, Resolver> = new Map<string, Resolver>([
    ["{externalid}", externalId],
    ["{clickid}", () => { const clickId = event().clickId; if (!clickId) throw new Error("Tracker visit ID is missing from the postback context."); return clickId; }],
    ["{click.id}", () => resolvers.get("{clickid}")!()],
    ["{event.id}", () => event().eventId],
    ["{event.type}", () => event().eventType],
    ["{transaction.id}", () => event().transactionReference ?? event().eventId],
    ["{payout}", () => payout(event().valueMinor, event().currency)],
    ["{payout.minor}", () => event().valueMinor.toString()],
    ["{payout.currency}", () => event().currency],
    ["{cost}", () => capturedValue(tokens, configuration.cost?.enabled !== false ? configuration.cost?.parameter : undefined)],
  ]);
  const registerMapping = (mapping: { parameter?: string; token?: string; enabled?: boolean } | undefined, resolver: Resolver) => {
    if (!mapping || mapping.enabled === false || !mapping.parameter) return;
    resolvers.set(`{param.${mapping.parameter.toLowerCase()}}`, resolver);
    if (mapping.token && /^\$?\{[^{}]+\}$/.test(mapping.token)) {
      const alias = normalizedPlaceholder(mapping.token);
      if (!resolvers.has(alias)) resolvers.set(alias, resolver);
    }
  };
  registerMapping(configuration.externalId, externalId);
  registerMapping(configuration.cost, resolvers.get("{cost}")!);
  configuration.parameters?.forEach((mapping, index) => {
    const resolver = () => capturedValue(tokens, mapping.enabled !== false ? mapping.parameter : undefined);
    resolvers.set(`{var${index + 1}}`, resolver);
    registerMapping(mapping, resolver);
  });
  return resolvers;
}

function parseTemplate(template: string): URL {
  const url = new URL(template);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Postback URL must use HTTP or HTTPS.");
  if (url.username || url.password) throw new Error("Postback URL must not contain URL login credentials.");
  if (/[{}]/.test(url.host) || /%7[bd]/i.test(url.host)) throw new Error("Postback destination must be a fixed hostname.");
  if (url.hash) throw new Error("Postback URL must not contain a fragment.");
  return url;
}

function templatePath(url: URL): string {
  return url.pathname.replace(/%7b/gi, "{").replace(/%7d/gi, "}");
}

function expand(value: string, resolvers: Map<string, Resolver>, resolve: boolean, path = false): string {
  const result = value.replace(placeholderPattern, (raw: string) => {
    const resolver = resolvers.get(normalizedPlaceholder(raw));
    if (!resolver) throw new Error(`Unsupported postback placeholder "${raw}".`);
    if (!resolve) return "";
    const resolved = resolver();
    if (path && /^\.{1,2}$/.test(resolved)) throw new Error("Postback path token must not be a relative path segment.");
    return path ? encodeURIComponent(resolved) : resolved;
  });
  if (/[{}]/.test(result)) throw new Error("Postback template contains an unresolved or malformed placeholder.");
  return result;
}

export function validateGenericPostbackTemplate(template: string, configuration: GenericProviderConfiguration): void {
  const url = parseTemplate(template);
  const resolvers = tokenResolvers(configuration, {});
  expand(templatePath(url), resolvers, false);
  for (const [key, value] of url.searchParams) {
    if (/[{}]/.test(key)) throw new Error("Postback query parameter names must be fixed.");
    expand(value, resolvers, false);
  }
}

export function buildGenericPostbackRequest(configuration: GenericProviderConfiguration, tokens: Record<string, unknown>, conversion: GenericPostbackConversion): { url: string; method: "GET"; headers: { accept: "*/*" } } {
  if (!configuration.postbackUrl) throw new Error("Postback URL is missing.");
  validateGenericPostbackTemplate(configuration.postbackUrl, configuration);
  const url = parseTemplate(configuration.postbackUrl);
  const resolvers = tokenResolvers(configuration, tokens, conversion);
  url.pathname = expand(templatePath(url), resolvers, true, true);
  const parameters = [...url.searchParams];
  url.search = "";
  for (const [key, value] of parameters) url.searchParams.append(key, expand(value, resolvers, true));
  return { url: url.toString(), method: "GET", headers: { accept: "*/*" } };
}
