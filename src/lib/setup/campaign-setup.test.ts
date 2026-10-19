import { describe, expect, it } from "vitest";
import { buildCampaignSetupReport } from "@/lib/setup/campaign-setup";

const campaign = {
  id: "campaign-id",
  slug: "client-offer",
  name: "Client offer",
  status: "active",
  destinationUrl: "https://money.example.test/offer",
  defaultCurrency: "IDR",
  allowedTrackingParameters: ["subid"],
  trafficSource: {
    type: "propeller",
    enabled: true,
    configuration: { postbackUrl: "https://provider.example.test/postback" },
  },
};

describe("campaign setup report", () => {
  it("generates the provider URL and GTM snippets without network work", () => {
    const report = buildCampaignSetupReport(campaign, "https://tracker.example.test");
    expect(report.trackingUrls.propeller).toContain("/t/client-offer");
    expect(report.trackingUrls.propeller).toContain("subid=${SUBID}");
    expect(report.gtm.snippets.map((snippet) => snippet.eventType)).toEqual(["reg", "ftd"]);
    expect(report.checks.externalCalls).toBe(false);
    expect(report.checks.providerConfigured).toBe(true);
    expect(report.checks.providerTokenAllowlisted).toBe(true);
  });

  it("reports missing provider readiness without exposing configuration", () => {
    const report = buildCampaignSetupReport({ ...campaign, trafficSource: { ...campaign.trafficSource, configuration: {} }, allowedTrackingParameters: [] }, "http://localhost:3000");
    expect(report.checks.providerConfigured).toBe(false);
    expect(report.providerError).toMatch(/postbackUrl/);
    expect(report.providerError).not.toContain("provider.example");
  });

  it("marks paused campaigns as not ready for a test click", () => {
    const report = buildCampaignSetupReport({ ...campaign, status: "paused" }, "http://localhost:3000");
    expect(report.checks.campaignActive).toBe(false);
    expect(report.gtm.postbackPath).toBe("/postback");
  });

  it("includes campaign and offer identifiers in direct URLs", () => {
    const report = buildCampaignSetupReport({
      ...campaign,
      id: "35a1009f-15e3-40ff-a359-7ed6326d7e19",
      offerId: "f7fc0d84-3b1c-4568-a6a4-18d412309b68",
      trackingMode: "direct",
      trafficSource: {
        ...campaign.trafficSource,
        configuration: {
          postbackUrl: "https://provider.example.test/postback",
          externalId: { parameter: "ACLID", token: "{ACLID}", enabled: true },
          cost: { parameter: "cost", token: "{cost}", enabled: true },
          parameters: [{ parameter: "CampaignID", token: "{CampaignID}", enabled: true }],
        },
      },
    }, "https://tracker.example.test");

    expect(report.trackingUrls.propeller).toContain("cpid=35a1009f-15e3-40ff-a359-7ed6326d7e19");
    expect(report.trackingUrls.propeller).toContain("oid=f7fc0d84-3b1c-4568-a6a4-18d412309b68");
    expect(report.trackingUrls.propeller).toContain("ACLID={ACLID}");
    expect(report.trackingUrls.propeller).toContain("cost={cost}");
    expect(report.trackingUrls.propeller).toContain("CampaignID={CampaignID}");
  });

  it("adds the built-in cost macro to redirect tracking URLs", () => {
    const report = buildCampaignSetupReport({
      ...campaign,
      trafficSource: {
        ...campaign.trafficSource,
        configuration: {
          postbackUrl: "https://provider.example.test/postback",
          cost: { parameter: "cost", token: "{cost}", enabled: true },
        },
      },
    }, "https://tracker.example.test");

    expect(report.trackingUrls.propeller).toContain("subid=${SUBID}");
    expect(report.trackingUrls.propeller).toContain("cost={cost}");
  });

  it("keeps the provider token when adding cost to a campaign without an explicit allowlist", () => {
    const report = buildCampaignSetupReport({
      ...campaign,
      allowedTrackingParameters: [],
      trafficSource: {
        ...campaign.trafficSource,
        configuration: {
          postbackUrl: "https://provider.example.test/postback",
          cost: { parameter: "cost", token: "{cost}", enabled: true },
        },
      },
    }, "https://tracker.example.test");

    expect(report.trackingUrls.propeller).toContain("subid=${SUBID}");
    expect(report.trackingUrls.propeller).toContain("cost={cost}");
  });
});
