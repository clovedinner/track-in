import { createHmac, timingSafeEqual } from "node:crypto";

export const NOWPAYMENTS_PROVIDER = "nowpayments";
export const NOWPAYMENTS_PAY_CURRENCY = "usdttrc20";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, sortJson(item)]));
}

export function stableNowPaymentsPayload(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function verifyNowPaymentsSignature(secret: string, value: unknown, signature: string): boolean {
  const provided = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(provided)) return false;
  const expected = createHmac("sha512", secret).update(stableNowPaymentsPayload(value), "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(provided, "hex"));
}

export function parseUsdCents(value: unknown): number | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function isNowPaymentsInvoiceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "nowpayments.io" || url.hostname.endsWith(".nowpayments.io"));
  } catch {
    return false;
  }
}

