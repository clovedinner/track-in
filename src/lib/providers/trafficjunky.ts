/**
 * TrafficJunky S2S conversion postback adapter.
 *
 * TrafficJunky's generated postback URL contains the tracker token and
 * member_id. The original ACLID must be captured on the incoming click and
 * sent back as `aclid` for attribution. The URL shape follows the documented
 * TrafficJunky template:
 *
 *   ...&cti=[TRANSACTION_UNIQ_ID]&ctv=[VALUE_OF_THE_TRANSACTION]
 *   &ctd=[TRANSACTION_DESCRIPTION]&aclid=[ACLID]
 */

const TRAFFICJUNKY_TOKEN_KEYS = ["ACLID", "aclid", "clickid", "click_id", "external_id"] as const;

export type TrafficJunkyConfig = {
  /** The generated TrafficJunky postback URL, including `a` and `member_id`. */
  postbackUrl: string;
  /** Optional transaction description override. */
  descriptionByEventType?: Record<string, string | undefined>;
};

export type TrafficJunkyConversion = {
  eventId: string;
  eventType: string;
  valueMinor?: bigint;
  currency?: string;
  description?: string;
};

export type TrafficJunkyRequest = {
  method: "GET";
  url: string;
  headers: { accept: "*/*" };
};

export type TrafficJunkyDelivery =
  | { outcome: "delivered"; responseStatus: number; responseSummary: string }
  | { outcome: "failed"; kind: "transient" | "permanent"; responseStatus: number; error: string };

function firstNonEmptyToken(tokens: Record<string, unknown>): string | undefined {
  for (const key of TRAFFICJUNKY_TOKEN_KEYS) {
    const value = tokens[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed.length <= 256) return trimmed;
    }
  }
  return undefined;
}

/** Resolve the original TrafficJunky click identifier, never the internal cid. */
export function resolveTrafficJunkyAclid(tokens: Record<string, unknown>): string {
  const aclid = firstNonEmptyToken(tokens);
  if (aclid === undefined) {
    throw new Error("TrafficJunky requires the original ACLID click token.");
  }
  return aclid;
}

function formatMinorUnits(valueMinor: bigint, currency: string | undefined): string {
  const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "IDR", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  if (currency !== undefined && zeroDecimalCurrencies.has(currency.toUpperCase())) return valueMinor.toString();

  const negative = valueMinor < BigInt(0);
  const absolute = negative ? -valueMinor : valueMinor;
  const digits = absolute.toString().padStart(3, "0");
  const formatted = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return negative ? `-${formatted}` : formatted;
}

function getDescription(config: TrafficJunkyConfig, conversion: TrafficJunkyConversion): string {
  const configured = config.descriptionByEventType?.[conversion.eventType.trim().toLowerCase()];
  const description = configured ?? conversion.description ?? conversion.eventType;
  const trimmed = description.trim();
  if (trimmed.length === 0 || trimmed.length > 256) {
    throw new Error("TrafficJunky transaction description must be between 1 and 256 characters.");
  }
  return trimmed;
}

/** Build the GET request expected by a generated TrafficJunky S2S postback URL. */
export function buildTrafficJunkyRequest(
  config: TrafficJunkyConfig,
  tokens: Record<string, unknown>,
  conversion: TrafficJunkyConversion,
): TrafficJunkyRequest {
  const destination = new URL(config.postbackUrl);
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    throw new Error("TrafficJunky postback URL must use HTTP or HTTPS.");
  }

  const eventId = conversion.eventId.trim();
  if (eventId.length === 0 || eventId.length > 256) throw new Error("TrafficJunky transaction ID is required.");

  destination.searchParams.set("aclid", resolveTrafficJunkyAclid(tokens));
  destination.searchParams.set("cti", eventId);
  destination.searchParams.set("ctd", getDescription(config, conversion));
  if (conversion.valueMinor !== undefined) {
    destination.searchParams.set("ctv", formatMinorUnits(conversion.valueMinor, conversion.currency));
  }

  return { method: "GET", url: destination.toString(), headers: { accept: "*/*" } };
}

export function classifyTrafficJunkyResponse(responseStatus: number): TrafficJunkyDelivery {
  if (responseStatus >= 200 && responseStatus < 300) {
    return { outcome: "delivered", responseStatus, responseSummary: "TrafficJunky accepted the postback." };
  }
  const transient = responseStatus === 408 || responseStatus === 425 || responseStatus === 429 || responseStatus >= 500;
  return {
    outcome: "failed",
    kind: transient ? "transient" : "permanent",
    responseStatus,
    error: `TrafficJunky responded with HTTP ${responseStatus}.`,
  };
}

export async function deliverTrafficJunkyRequest(
  request: TrafficJunkyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<TrafficJunkyDelivery> {
  try {
    const response = await fetchImpl(request.url, { method: request.method, headers: request.headers });
    return classifyTrafficJunkyResponse(response.status);
  } catch (error) {
    return {
      outcome: "failed",
      kind: "transient",
      responseStatus: 0,
      error: error instanceof Error ? error.message.slice(0, 500) : "TrafficJunky request failed.",
    };
  }
}

/** Redact TrafficJunky tracker credentials before logging a generated URL. */
export function redactTrafficJunkyUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  for (const key of ["a", "member_id"]) {
    if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]");
  }
  return url.toString();
}
