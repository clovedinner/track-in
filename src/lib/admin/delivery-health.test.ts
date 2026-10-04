import { describe, expect, it } from "vitest";

import {
  destinationHost,
  parseDeliveryHealthLimit,
  parseDeliveryHealthStatus,
  sanitizeDiagnostic,
} from "@/lib/admin/delivery-health";

describe("delivery health query helpers", () => {
  it("accepts supported statuses and rejects unknown values", () => {
    expect(parseDeliveryHealthStatus("retryable_failed")).toBe("retryable_failed");
    expect(parseDeliveryHealthStatus("failed")).toBeUndefined();
    expect(parseDeliveryHealthStatus(null)).toBeUndefined();
  });

  it("bounds the result limit", () => {
    expect(parseDeliveryHealthLimit(null)).toBe(50);
    expect(parseDeliveryHealthLimit("100")).toBe(100);
    expect(() => parseDeliveryHealthLimit("101")).toThrow();
    expect(() => parseDeliveryHealthLimit("nope")).toThrow();
  });

  it("redacts diagnostics and exposes only a destination host", () => {
    expect(sanitizeDiagnostic("authorization: Bearer secret-value, token=abc")).toBe(
      "authorization=[redacted], token=[redacted]",
    );
    expect(destinationHost("https://ads.example.test/postback?token=secret")).toBe("ads.example.test");
    expect(destinationHost("not-a-url")).toBeNull();
  });
});
