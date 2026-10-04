/**
 * PropellerAds S2S conversion postback adapter.
 *
 * PropellerAds' standard advertiser URL is a GET request to
 * `conversion.php` with the original click identifier in `visitor_id`.
 * The adapter deliberately accepts the token map captured on the click
 * instead of treating Track.in's internal click ID as a Propeller ID.
 */

export type PropellerConversion = {
  eventType: string;
  valueMinor?: bigint;
  currency?: string;
};

export type PropellerAdsConfig = {
  /** Usually https://ad.propellerads.com/conversion.php. */
  postbackUrl: string;
  aid?: string;
  pid?: string;
  tid?: string;
  /** Optional explicit event-to-goal mapping. `undefined` means main conversion. */
  goalByEventType?: Record<string, number | undefined>;
};

export type PropellerAdsRequest = {
  url: string;
  method: "GET";
  headers: Record<string, string>;
};

export type PropellerAdsDelivery = {
  outcome: "delivered" | "failed";
  kind?: "transient" | "permanent";
  responseStatus: number;
  responseSummary?: string;
  error?: string;
};

const DEFAULT_EVENT_GOALS: Record<string, number | undefined> = {
  registration: undefined,
  reg: undefined,
  conversion: undefined,
  purchase: undefined,
  ftd: 2,
  first_deposit: 2,
  first_deposit_completed: 2,
  redeposit: 3,
};

const PROPeller_TOKEN_KEYS = ["subid", "SUBID", "clickid", "CLICKID", "click_id", "CLICK_ID"] as const;

function firstNonEmptyToken(tokens: Record<string, unknown>): string | undefined {
  for (const key of PROPeller_TOKEN_KEYS) {
    const value = tokens[key];
    if (typeof value === "string" && value.length > 0 && value.length <= 256) {
      return value;
    }
  }
  return undefined;
}

export function resolvePropellerSubId(tokens: Record<string, unknown>): string {
  const subId = firstNonEmptyToken(tokens);
  if (subId === undefined) {
    throw new Error("PropellerAds requires the original click token (SUBID/clickid).");
  }
  return subId;
}

function formatMinorUnits(valueMinor: bigint, currency: string): string {
  const exponent = currency.toUpperCase() === "IDR" ? 0 : 2;
  if (exponent === 0) return valueMinor.toString();
  const negative = valueMinor < BigInt(0);
  const absolute = negative ? -valueMinor : valueMinor;
  const digits = absolute.toString().padStart(exponent + 1, "0");
  const split = digits.length - exponent;
  const value = `${digits.slice(0, split)}.${digits.slice(split)}`;
  return negative ? `-${value}` : value;
}

export function getPropellerGoal(
  eventType: string,
  configuredGoals: Record<string, number | undefined> = {},
): number | undefined {
  const normalized = eventType.trim().toLowerCase();
  const goal = configuredGoals[normalized] ?? DEFAULT_EVENT_GOALS[normalized];
  if (goal === undefined) return undefined;
  if (!Number.isInteger(goal) || goal < 1 || goal > 100) {
    throw new Error("PropellerAds goal must be an integer between 1 and 100.");
  }
  return goal;
}

export function buildPropellerAdsRequest(
  config: PropellerAdsConfig,
  tokens: Record<string, unknown>,
  conversion: PropellerConversion,
): PropellerAdsRequest {
  const destination = new URL(config.postbackUrl);
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    throw new Error("PropellerAds postback URL must use HTTP or HTTPS.");
  }

  destination.searchParams.set("visitor_id", resolvePropellerSubId(tokens));
  if (config.aid !== undefined) destination.searchParams.set("aid", config.aid);
  if (config.pid !== undefined) destination.searchParams.set("pid", config.pid);
  if (config.tid !== undefined) destination.searchParams.set("tid", config.tid);

  const goal = getPropellerGoal(conversion.eventType, config.goalByEventType);
  if (goal !== undefined) destination.searchParams.set("goal", String(goal));
  if (conversion.valueMinor !== undefined) {
    destination.searchParams.set(
      "payout",
      formatMinorUnits(conversion.valueMinor, conversion.currency ?? "USD"),
    );
  }

  return { url: destination.toString(), method: "GET", headers: { accept: "*/*" } };
}

export function classifyPropellerAdsResponse(responseStatus: number): PropellerAdsDelivery {
  if (responseStatus >= 200 && responseStatus < 300) {
    return { outcome: "delivered", responseStatus };
  }
  const transient = responseStatus === 408 || responseStatus === 425 || responseStatus === 429 || responseStatus >= 500;
  return {
    outcome: "failed",
    kind: transient ? "transient" : "permanent",
    responseStatus,
    error: `PropellerAds responded with HTTP ${responseStatus}.`,
  };
}

export async function deliverPropellerAdsRequest(
  request: PropellerAdsRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<PropellerAdsDelivery> {
  try {
    const response = await fetchImpl(request.url, { method: request.method, headers: request.headers });
    return classifyPropellerAdsResponse(response.status);
  } catch (error) {
    return {
      outcome: "failed",
      kind: "transient",
      responseStatus: 0,
      error: error instanceof Error ? error.message : "PropellerAds request failed.",
    };
  }
}
