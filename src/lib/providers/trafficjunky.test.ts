import { describe, expect, it, vi } from "vitest";

import {
  buildTrafficJunkyRequest,
  classifyTrafficJunkyResponse,
  deliverTrafficJunkyRequest,
  redactTrafficJunkyUrl,
  resolveTrafficJunkyAclid,
} from "@/lib/providers/trafficjunky";

describe("TrafficJunky provider", () => {
  it("maps ACLID, transaction ID, value, and description to the generated URL", () => {
    const request = buildTrafficJunkyRequest(
      { postbackUrl: "https://ads.trafficjunky.net/tj_ads_pt?a=tracker-token&member_id=123" },
      { ACLID: "tj-click-123" },
      { eventId: "conversion-123", eventType: "ftd", valueMinor: BigInt(12345), currency: "USD", description: "First deposit" },
    );
    const url = new URL(request.url);
    expect(url.searchParams.get("aclid")).toBe("tj-click-123");
    expect(url.searchParams.get("cti")).toBe("conversion-123");
    expect(url.searchParams.get("ctv")).toBe("123.45");
    expect(url.searchParams.get("ctd")).toBe("First deposit");
  });

  it("supports lowercase token keys and zero-decimal currencies", () => {
    const request = buildTrafficJunkyRequest(
      { postbackUrl: "http://ads.trafficjunky.net/tj_ads_pt?a=token&member_id=1", descriptionByEventType: { reg: "Signup" } },
      { aclid: "tj-click-2" },
      { eventId: "event-2", eventType: "reg", valueMinor: BigInt(500000), currency: "IDR" },
    );
    const url = new URL(request.url);
    expect(url.searchParams.get("ctv")).toBe("500000");
    expect(url.searchParams.get("ctd")).toBe("Signup");
  });

  it("requires the original ACLID rather than the internal click ID", () => {
    expect(() => resolveTrafficJunkyAclid({ cid: "internal-click" })).toThrow(/ACLID/);
  });

  it("classifies success, retryable, and permanent responses", () => {
    expect(classifyTrafficJunkyResponse(204).outcome).toBe("delivered");
    expect(classifyTrafficJunkyResponse(429)).toMatchObject({ outcome: "failed", kind: "transient" });
    expect(classifyTrafficJunkyResponse(400)).toMatchObject({ outcome: "failed", kind: "permanent" });
  });

  it("keeps transport injectable for provider contract tests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await deliverTrafficJunkyRequest(
      { url: "https://ads.trafficjunky.net/tj_ads_pt?aclid=tj-click-3", method: "GET", headers: { accept: "*/*" } },
      fetchImpl,
    );
    expect(result.outcome).toBe("delivered");
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("aclid=tj-click-3"), expect.any(Object));
  });

  it("redacts generated tracker credentials from diagnostics", () => {
    const redacted = redactTrafficJunkyUrl("https://ads.trafficjunky.net/tj_ads_pt?a=secret-token&member_id=123&aclid=click");
    expect(redacted).toContain("a=%5Bredacted%5D");
    expect(redacted).toContain("member_id=%5Bredacted%5D");
    expect(redacted).not.toContain("secret-token");
  });
});
