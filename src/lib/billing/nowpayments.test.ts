import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { isNowPaymentsInvoiceUrl, parseUsdCents, stableNowPaymentsPayload, verifyNowPaymentsSignature } from "./nowpayments";

describe("NOWPayments helpers", () => {
  it("verifies signatures over recursively sorted JSON", () => {
    const secret = "ipn-secret-for-test";
    const payload = { z: 1, nested: { b: true, a: "value" }, a: [2, 1] };
    const signature = createHmac("sha512", secret).update(stableNowPaymentsPayload(payload)).digest("hex");

    expect(verifyNowPaymentsSignature(secret, payload, signature)).toBe(true);
    expect(verifyNowPaymentsSignature(secret, { ...payload, z: 3 }, signature)).toBe(false);
    expect(verifyNowPaymentsSignature(secret, payload, "invalid")).toBe(false);
  });

  it("parses USD prices to exact cents and rejects ambiguous values", () => {
    expect(parseUsdCents("300")).toBe(30_000);
    expect(parseUsdCents("0.1")).toBe(10);
    expect(parseUsdCents("300.009")).toBeNull();
    expect(parseUsdCents("1e2")).toBeNull();
  });

  it("accepts only secure NOWPayments-hosted invoice links", () => {
    expect(isNowPaymentsInvoiceUrl("https://nowpayments.io/payment/?iid=1")).toBe(true);
    expect(isNowPaymentsInvoiceUrl("http://nowpayments.io/payment/?iid=1")).toBe(false);
    expect(isNowPaymentsInvoiceUrl("https://attacker.example/payment")).toBe(false);
  });
});
