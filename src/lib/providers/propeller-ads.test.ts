import { describe, expect, it, vi } from "vitest";

import {
  buildPropellerAdsRequest,
  classifyPropellerAdsResponse,
  deliverPropellerAdsRequest,
  getPropellerGoal,
  resolvePropellerSubId,
} from "@/lib/providers/propeller-ads";

describe("PropellerAds adapter", () => {
  it("uses the original SUBID as visitor_id and maps FTD to goal 2", () => {
    const request = buildPropellerAdsRequest(
      { postbackUrl: "https://ad.propellerads.com/conversion.php", aid: "aid-1", pid: "pid-2", tid: "tid-3" },
      { SUBID: "propeller-click-1" },
      { eventType: "ftd", valueMinor: BigInt(500000), currency: "IDR" },
    );

    const url = new URL(request.url);
    expect(url.searchParams.get("visitor_id")).toBe("propeller-click-1");
    expect(url.searchParams.get("aid")).toBe("aid-1");
    expect(url.searchParams.get("pid")).toBe("pid-2");
    expect(url.searchParams.get("tid")).toBe("tid-3");
    expect(url.searchParams.get("goal")).toBe("2");
    expect(url.searchParams.get("payout")).toBe("500000");
  });

  it("leaves the main conversion goal unset and formats decimal currencies", () => {
    const request = buildPropellerAdsRequest(
      { postbackUrl: "https://ad.propellerads.com/conversion.php" },
      { click_id: "click-2" },
      { eventType: "reg", valueMinor: BigInt(1999), currency: "USD" },
    );
    const url = new URL(request.url);
    expect(url.searchParams.get("goal")).toBeNull();
    expect(url.searchParams.get("payout")).toBe("19.99");
  });

  it("supports explicit goal mappings and rejects invalid goals", () => {
    expect(getPropellerGoal("deposit", { deposit: 4 })).toBe(4);
    expect(() => getPropellerGoal("deposit", { deposit: 0 })).toThrow();
    expect(() => resolvePropellerSubId({ cid: "internal-only" })).toThrow();
  });

  it("classifies success, retryable, and permanent responses", () => {
    expect(classifyPropellerAdsResponse(200).outcome).toBe("delivered");
    expect(classifyPropellerAdsResponse(429).kind).toBe("transient");
    expect(classifyPropellerAdsResponse(503).kind).toBe("transient");
    expect(classifyPropellerAdsResponse(400).kind).toBe("permanent");
  });

  it("keeps transport injectable for contract tests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await deliverPropellerAdsRequest(
      { url: "https://ad.propellerads.com/conversion.php?visitor_id=click-3", method: "GET", headers: { accept: "*/*" } },
      fetchImpl,
    );
    expect(result.outcome).toBe("delivered");
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("visitor_id=click-3"), expect.any(Object));
  });
});
