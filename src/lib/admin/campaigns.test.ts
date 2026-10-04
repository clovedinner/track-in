import { describe, expect, it } from "vitest";

import { CampaignInputError, parseCreateCampaignInput } from "./campaigns";

const validCampaign = {
  slug: "spring-sale",
  name: "Spring Sale",
  destinationUrl: "https://shop.example.com/offer",
  defaultCurrency: "idr",
  allowedTrackingParameters: ["fbclid", "utm_campaign"],
};

describe("parseCreateCampaignInput", () => {
  it("normalizes valid campaign data and defaults status", () => {
    expect(parseCreateCampaignInput(validCampaign)).toEqual({
      ...validCampaign,
      defaultCurrency: "IDR",
      status: "paused",
    });
  });

  it.each([
    ["invalid slug", { slug: "Spring Sale" }, "slug"],
    ["non-HTTPS destination", { destinationUrl: "http://shop.example.com" }, "destinationUrl"],
    ["destination with credentials", { destinationUrl: "https://user:pass@shop.example.com" }, "destinationUrl"],
    ["invalid status", { status: "running" }, "status"],
    ["invalid currency", { defaultCurrency: "US" }, "defaultCurrency"],
    ["invalid traffic source", { trafficSourceId: "not-a-uuid" }, "trafficSourceId"],
    ["reserved token", { allowedTrackingParameters: ["cid"] }, "allowedTrackingParameters"],
  ])("rejects %s", (_label, override, field) => {
    expect(() => parseCreateCampaignInput({ ...validCampaign, ...override })).toThrow(CampaignInputError);
    try {
      parseCreateCampaignInput({ ...validCampaign, ...override });
    } catch (error) {
      expect(error).toMatchObject({ field });
    }
  });

  it("rejects duplicate tracking parameters", () => {
    expect(() =>
      parseCreateCampaignInput({ ...validCampaign, allowedTrackingParameters: ["fbclid", "fbclid"] }),
    ).toThrow("Tracking parameters must be unique");
  });
});
