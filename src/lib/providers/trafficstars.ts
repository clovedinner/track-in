const DEFAULT_TRAFFICSTARS_ENDPOINT = "https://tsyndicate.com/api/v1/cpa/action";

export type TrafficStarsConfig = {
  /** A generated TrafficStars postback URL, or the endpoint without query parameters. */
  postbackUrl?: string;
  endpoint?: string;
  key?: string;
  allowDuplicates?: boolean;
  goalId?: string;
};

export type TrafficStarsConversion = {
  clickId: string;
  eventId: string;
  eventType: string;
  valueMinor?: bigint;
  currency?: string;
  /** TrafficStars accepts multiple events for one click when this is unique. */
  leadCode?: string;
  /** Optional CPA conversion price, in the configured minor-unit representation. */
  priceMinor?: bigint;
};

export type TrafficStarsRequest = {
  method: "GET";
  url: string;
  headers: { accept: "*/*" };
};

function validHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("TrafficStars postback URL must use HTTPS.");
  }
  return url;
}

function setIfPresent(url: URL, key: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    url.searchParams.set(key, value);
  }
}

function minorToDecimal(value: bigint | undefined, currency: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  // TrafficStars documents value/price as digital values. Keep zero-decimal currencies
  // exact and use the conventional two-decimal representation for other currencies.
  const zeroDecimal = currency !== undefined && ["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"].includes(currency.toUpperCase());
  if (zeroDecimal) return value.toString();
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const raw = absolute.toString().padStart(3, "0");
  const result = `${raw.slice(0, -2)}.${raw.slice(-2)}`;
  return negative ? `-${result}` : result;
}

/**
 * Build the TrafficStars CPA action request from a conversion and the original
 * TrafficStars click token captured on the incoming click.
 */
export function buildTrafficStarsRequest(
  config: TrafficStarsConfig,
  conversion: TrafficStarsConversion,
): TrafficStarsRequest {
  const rawUrl = config.postbackUrl ?? config.endpoint ?? DEFAULT_TRAFFICSTARS_ENDPOINT;
  const url = validHttpsUrl(rawUrl);
  const clickId = conversion.clickId.trim();
  if (clickId.length === 0 || clickId.length > 256) throw new Error("TrafficStars click ID is required.");
  if (config.key !== undefined) setIfPresent(url, "key", config.key);
  setIfPresent(url, "clickid", clickId);
  setIfPresent(url, "value", minorToDecimal(conversion.valueMinor, conversion.currency));
  setIfPresent(url, "price", minorToDecimal(conversion.priceMinor, conversion.currency));
  setIfPresent(url, "lead_code", conversion.leadCode ?? conversion.eventId);
  setIfPresent(url, "goalid", config.goalId);
  if (config.allowDuplicates === true) url.searchParams.set("allow_duplicates", "1");
  return { method: "GET", url: url.toString(), headers: { accept: "*/*" } };
}

export type TrafficStarsResponse = { status: number };

export function classifyTrafficStarsResponse(response: TrafficStarsResponse):
  | { outcome: "delivered"; responseStatus: number; responseSummary: string }
  | { outcome: "failed"; kind: "transient" | "permanent"; responseStatus: number; error: string } {
  if (response.status >= 200 && response.status < 300) {
    return { outcome: "delivered", responseStatus: response.status, responseSummary: "TrafficStars accepted the postback." };
  }
  const transient = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  return {
    outcome: "failed",
    kind: transient ? "transient" : "permanent",
    responseStatus: response.status,
    error: `TrafficStars returned HTTP ${response.status}.`,
  };
}

export function classifyTrafficStarsNetworkError(error: unknown): { outcome: "failed"; kind: "transient"; error: string } {
  return { outcome: "failed", kind: "transient", error: error instanceof Error ? error.message.slice(0, 500) : "TrafficStars request failed." };
}

/** Remove the advertiser key before writing a request URL to logs. */
export function redactTrafficStarsUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.searchParams.has("key")) url.searchParams.set("key", "[redacted]");
  return url.toString();
}
