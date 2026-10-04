import { describe, expect, it } from "vitest";
import {
  buildAllCampaignTrackingUrls,
  buildCampaignTrackingUrl,
  getTrackingUrlDefinition,
} from "@/lib/tracking/campaign-url";

describe("campaign tracking URL generation", () => {
  it.each([
    ["trafficstars", "clickid", "{click_id}"],
    ["propeller", "subid", "${SUBID}"],
    ["trafficjunky", "ACLID", "{ACLID}"],
  ] as const)("uses the %s source token macro", (provider, parameter, macro) => {
    const url = new URL(buildCampaignTrackingUrl({
      trackerBaseUrl: "https://tracker.example.test",
      campaignSlug: "client-offer",
      provider,
      allowedTrackingParameters: [parameter],
    }));

    expect(url.pathname).toBe("/t/client-offer");
    expect(url.searchParams.get(parameter)).toBe(macro);
  });

  it("preserves only explicitly allowlisted additional macros", () => {
    const url = new URL(buildCampaignTrackingUrl({
      trackerBaseUrl: "https://tracker.example.test/",
      campaignSlug: "offer-1",
      provider: "propeller",
      allowedTrackingParameters: ["subid", "zoneid", "campaign_id"],
      additionalParameters: { zoneid: "{zoneid}", campaign_id: "{campaign_id}" },
    }));

    expect(url.searchParams.get("subid")).toBe("${SUBID}");
    expect(url.searchParams.get("zoneid")).toBe("{zoneid}");
    expect(url.searchParams.get("campaign_id")).toBe("{campaign_id}");
  });

  it("rejects an additional parameter that is not allowlisted", () => {
    expect(() => buildCampaignTrackingUrl({
      trackerBaseUrl: "https://tracker.example.test",
      campaignSlug: "offer-1",
      provider: "trafficstars",
      allowedTrackingParameters: ["clickid"],
      additionalParameters: { zoneid: "{zoneid}" },
    })).toThrow(/allowlist/);
  });

  it("rejects unsafe base URLs and ambiguous URL components", () => {
    expect(() => buildCampaignTrackingUrl({
      trackerBaseUrl: "javascript:alert(1)",
      campaignSlug: "offer-1",
      provider: "trafficjunky",
    })).toThrow(/HTTP or HTTPS/);

    expect(() => buildCampaignTrackingUrl({
      trackerBaseUrl: "https://tracker.example.test/?secret=1",
      campaignSlug: "offer-1",
      provider: "trafficjunky",
    })).toThrow(/query string/);
  });

  it("requires the provider token to be represented in a non-empty allowlist", () => {
    expect(() => buildCampaignTrackingUrl({
      trackerBaseUrl: "https://tracker.example.test",
      campaignSlug: "offer-1",
      provider: "trafficjunky",
      allowedTrackingParameters: ["zoneid"],
    })).toThrow(/ACLID/);
  });

  it("generates all supported provider URLs from one campaign input", () => {
    const urls = buildAllCampaignTrackingUrls({
      trackerBaseUrl: "https://tracker.example.test",
      campaignSlug: "offer-1",
    });

    expect(Object.keys(urls)).toEqual(["trafficstars", "propeller", "trafficjunky"]);
    expect(getTrackingUrlDefinition("trafficstars").label).toBe("TrafficStars");
    expect(new URL(urls.propeller).searchParams.get("subid")).toBe("${SUBID}");
  });
});
