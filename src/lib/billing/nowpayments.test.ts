import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildNowPaymentsInvoiceRequest, isNowPaymentsInvoiceUrl, parseUsdCents, stableNowPaymentsPayload, verifyNowPaymentsSignature } from "./nowpayments";

describe("NOWPayments helpers", () => {
  it("passes the plan price in USD and asks the customer to cover provider fees", () => {
    expect(buildNowPaymentsInvoiceRequest({
      amountMinor: 50_000,
      callbackUrl: "https://trakio.org/api/billing/nowpayments",
      cancelUrl: "https://trakio.org/admin/subscribe?payment=cancelled",
      invoiceId: "trk_inv_test",
      plan: "Operator",
      successUrl: "https://trakio.org/payment-done?invoice_id=trk_inv_test",
    })).toEqual({
      price_amount: 500,
      price_currency: "usd",
      pay_currency: "usdttrc20",
      ipn_callback_url: "https://trakio.org/api/billing/nowpayments",
      order_id: "trk_inv_test",
      order_description: "Trakio Operator subscription",
      success_url: "https://trakio.org/payment-done?invoice_id=trk_inv_test",
      cancel_url: "https://trakio.org/admin/subscribe?payment=cancelled",
      is_fee_paid_by_user: true,
    });
  });

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
