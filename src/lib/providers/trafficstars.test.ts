import { describe, expect, it } from "vitest";

import {
  buildTrafficStarsRequest,
  classifyTrafficStarsNetworkError,
  classifyTrafficStarsResponse,
  redactTrafficStarsUrl,
} from "@/lib/providers/trafficstars";

describe("TrafficStars provider", () => {
  it("maps the original click token and a unique lead code", () => {
    const result = buildTrafficStarsRequest(
      { endpoint: "https://tsyndicate.com/api/v1/cpa/action", key: "secret-key" },
      { clickId: "ts-click-123", eventId: "conversion-123", eventType: "ftd", valueMinor: BigInt(12345), currency: "USD" },
    );
    const url = new URL(result.url);
    expect(url.searchParams.get("key")).toBe("secret-key");
    expect(url.searchParams.get("clickid")).toBe("ts-click-123");
    expect(url.searchParams.get("lead_code")).toBe("conversion-123");
    expect(url.searchParams.get("value")).toBe("123.45");
  });

  it("preserves generated postback parameters and supports duplicate mode", () => {
    const result = buildTrafficStarsRequest(
      { postbackUrl: "https://tsyndicate.com/api/v1/cpa/action?key=generated", allowDuplicates: true, goalId: "7" },
      { clickId: "click", eventId: "event", eventType: "reg", valueMinor: BigInt(1), currency: "JPY" },
    );
    const url = new URL(result.url);
    expect(url.searchParams.get("goalid")).toBe("7");
    expect(url.searchParams.get("allow_duplicates")).toBe("1");
    expect(url.searchParams.get("value")).toBe("1");
  });

  it("classifies HTTP failures for bounded retry behavior", () => {
    expect(classifyTrafficStarsResponse({ status: 204 }).outcome).toBe("delivered");
    expect(classifyTrafficStarsResponse({ status: 429 })).toMatchObject({ outcome: "failed", kind: "transient" });
    expect(classifyTrafficStarsResponse({ status: 400 })).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(classifyTrafficStarsNetworkError(new Error("timeout")).kind).toBe("transient");
  });

  it("redacts the advertiser key from diagnostics", () => {
    expect(redactTrafficStarsUrl("https://tsyndicate.com/api/v1/cpa/action?key=secret&clickid=abc")).toContain("key=%5Bredacted%5D");
    expect(redactTrafficStarsUrl("https://tsyndicate.com/api/v1/cpa/action?key=secret&clickid=abc")).not.toContain("secret");
  });

  it("rejects non-HTTPS destinations", () => {
    expect(() => buildTrafficStarsRequest({ endpoint: "http://example.test/postback" }, { clickId: "click", eventId: "event", eventType: "reg" })).toThrow(/HTTPS/);
  });
});
