import { describe, expect, it } from "vitest";

import {
  getPostbackDestination,
  hasValidBearerSecret,
  parseConversionPayload,
  parseVoluumPostback,
} from "./intake";

describe("conversion intake", () => {
  it("accepts a valid money-site payload and normalizes currency", () => {
    const result = parseConversionPayload({
      cid: "opaque-click-id",
      event_id: "order-123",
      event_type: "purchase",
      occurred_at: "2026-10-04T00:00:00.000Z",
      value_minor: 500000,
      currency: "idr",
    });

    expect(result.currency).toBe("IDR");
    expect(result.value_minor).toBe(BigInt(500000));
  });

  it("rejects missing or unsafe values", () => {
    expect(() => parseConversionPayload({ cid: "click" })).toThrow();
    expect(() =>
      parseConversionPayload({
        cid: "click",
        event_id: "event",
        event_type: "purchase",
        occurred_at: "2026-10-04T00:00:00.000Z",
        value_minor: -1,
        currency: "IDR",
      }),
    ).toThrow();
  });

  it("compares bearer secrets without accepting a near match", () => {
    expect(hasValidBearerSecret("Bearer test-secret", "test-secret")).toBe(true);
    expect(hasValidBearerSecret("Bearer wrong-secret", "test-secret")).toBe(false);
    expect(hasValidBearerSecret(null, "test-secret")).toBe(false);
  });

  it("accepts only configured HTTP postback destinations", () => {
    expect(getPostbackDestination({ postbackUrl: "https://ads.example.test/conversion" })).toBe(
      "https://ads.example.test/conversion",
    );
    expect(getPostbackDestination({ postbackUrl: "javascript:alert(1)" })).toBeUndefined();
    expect(getPostbackDestination({})).toBeUndefined();
  });

  it("parses Voluum-compatible registration and FTD events", () => {
    const registration = parseVoluumPostback(
      new URL("https://tracker.example.test/postback?cid=click-123&et=reg"),
    );
    const ftd = parseVoluumPostback(
      new URL("https://tracker.example.test/postback?cid=click-123&et=ftd&txid=deposit-1&payout=500000&currency=idr"),
    );

    expect(registration.eventId).toBe("voluum:click-123:reg");
    expect(ftd.eventId).toBe("voluum:click-123:deposit-1");
    expect(ftd.valueMinor).toBe(BigInt(500000));
    expect(ftd.currency).toBe("IDR");
  });

  it("rejects malformed Voluum-compatible values", () => {
    expect(() => parseVoluumPostback(new URL("https://tracker.test/postback?et=reg"))).toThrow();
    expect(() => parseVoluumPostback(new URL("https://tracker.test/postback?cid=click&et=ftd&payout=-1"))).toThrow();
  });
});
