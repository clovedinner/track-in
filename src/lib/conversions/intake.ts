import { createHash, timingSafeEqual } from "node:crypto";

export const MONEY_SITE_SOURCE = "primary_money_site";
export const VOLUUM_COMPAT_SOURCE = "voluum_compat";
export const MAX_CONVERSION_BODY_BYTES = 32 * 1024;

export type ConversionInput = {
  cid: string;
  event_id: string;
  event_type: string;
  occurred_at: Date;
  value_minor: bigint;
  currency: string;
  transaction_reference?: string;
};

export type ConversionPayload = Record<string, unknown>;

export type VoluumPostbackInput = {
  cid: string;
  eventType: string;
  eventId: string;
  occurredAt: Date;
  valueMinor: bigint;
  currency?: string;
  transactionReference?: string;
};

export function hasValidBearerSecret(authorization: string | null, expected: string | undefined): boolean {
  if (expected === undefined || authorization === null || !authorization.startsWith("Bearer ")) {
    return false;
  }

  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const configured = Buffer.from(expected, "utf8");
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

function requiredString(payload: ConversionPayload, key: string, maxLength: number): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : undefined;
}

export function parseConversionPayload(payload: unknown): ConversionInput {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Conversion body must be a JSON object.");
  }

  const body = payload as ConversionPayload;
  const cid = requiredString(body, "cid", 256);
  const eventId = requiredString(body, "event_id", 256);
  const eventType = requiredString(body, "event_type", 64);
  const occurredAtRaw = requiredString(body, "occurred_at", 64);
  const currency = requiredString(body, "currency", 3)?.toUpperCase();
  const rawValue = body.value_minor;
  const transactionReference = body.transaction_reference;

  if (cid === undefined || eventId === undefined || eventType === undefined || occurredAtRaw === undefined) {
    throw new Error("cid, event_id, event_type, and occurred_at are required.");
  }
  if (currency === undefined || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a three-letter ISO code.");
  }
  if (
    typeof rawValue !== "number" &&
    typeof rawValue !== "string" &&
    typeof rawValue !== "bigint"
  ) {
    throw new Error("value_minor must be a non-negative integer.");
  }

  let valueMinor: bigint;
  try {
    valueMinor = BigInt(rawValue);
  } catch {
    throw new Error("value_minor must be a non-negative integer.");
  }
  if (valueMinor < BigInt(0) || (typeof rawValue === "number" && !Number.isSafeInteger(rawValue))) {
    throw new Error("value_minor must be a non-negative integer.");
  }

  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("occurred_at must be a valid ISO timestamp.");
  }
  if (transactionReference !== undefined && (typeof transactionReference !== "string" || transactionReference.length > 256)) {
    throw new Error("transaction_reference must be a string of 256 characters or fewer.");
  }

  return {
    cid,
    event_id: eventId,
    event_type: eventType,
    occurred_at: occurredAt,
    value_minor: valueMinor,
    currency,
    ...(transactionReference === undefined ? {} : { transaction_reference: transactionReference }),
  };
}

export function parseVoluumPostback(url: URL, now = new Date()): VoluumPostbackInput {
  const cid = url.searchParams.get("cid")?.trim();
  const eventType = (url.searchParams.get("et") ?? "conversion").trim().toLowerCase();
  const transactionId = url.searchParams.get("txid")?.trim();
  const rawValue = url.searchParams.get("value_minor") ?? url.searchParams.get("payout") ?? url.searchParams.get("value");
  const currency = url.searchParams.get("currency")?.trim().toUpperCase();

  if (cid === undefined || cid.length === 0 || cid.length > 256) {
    throw new Error("cid is required.");
  }
  if (!/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(eventType)) {
    throw new Error("et must contain only letters, numbers, dots, underscores, colons, or hyphens.");
  }
  if (transactionId !== undefined && (transactionId.length === 0 || transactionId.length > 256)) {
    throw new Error("txid must contain between 1 and 256 characters.");
  }
  if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a three-letter ISO code.");
  }

  let valueMinor = BigInt(0);
  if (rawValue !== null) {
    if (!/^\d{1,18}$/.test(rawValue)) {
      throw new Error("value_minor, payout, or value must be a non-negative integer.");
    }
    valueMinor = BigInt(rawValue);
  }

  return {
    cid,
    eventType,
    eventId: `voluum:${cid}:${transactionId ?? eventType}`,
    occurredAt: now,
    valueMinor,
    ...(currency === undefined ? {} : { currency }),
    ...(transactionId === undefined ? {} : { transactionReference: transactionId }),
  };
}

export function hashConversionPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getPostbackDestination(configuration: unknown): string | undefined {
  if (configuration === null || typeof configuration !== "object" || Array.isArray(configuration)) {
    return undefined;
  }
  const record = configuration as Record<string, unknown>;
  const destination = record.postbackUrl ?? record.endpoint;
  return typeof destination === "string" && /^https?:\/\//.test(destination) ? destination : undefined;
}
