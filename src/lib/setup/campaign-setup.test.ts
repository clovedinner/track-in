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
    expect(report.trackingUrls.propeller).toContain("%24%7BSUBID%7D");
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
});
