import { describe, expect, it } from "vitest";

import {
  buildTrackingDestination,
  collectTrackingTokens,
  createClickId,
  enabledTrafficSourceParameters,
} from "./click";

describe("click tracking helpers", () => {
  it("uses enabled traffic-source parameter mappings as the click allowlist", () => {
    expect(enabledTrafficSourceParameters({
      externalId: { parameter: "ACLID", enabled: true },
      parameters: [
        { parameter: "CampaignID", enabled: true },
        { parameter: "Disabled", enabled: false },
        { parameter: "ACLID", enabled: true },
      ],
    })).toEqual(["ACLID", "CampaignID"]);
  });

  it("creates URL-safe opaque click IDs", () => {
    const first = createClickId();
    const second = createClickId();

    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
  });

  it("keeps only configured tracking parameters", () => {
    const query = new URLSearchParams("fbclid=abc123&campaign=ignored&cid=spoofed");

    expect(collectTrackingTokens(query, ["fbclid", "campaign", "cid"])).toEqual({
      fbclid: "abc123",
      campaign: "ignored",
    });
  });

  it("matches configured tracking parameter names without case sensitivity", () => {
    const query = new URLSearchParams("subid=propeller-click-123");

    expect(collectTrackingTokens(query, ["SUBID"])).toEqual({
      SUBID: "propeller-click-123",
    });
  });

  it("does not allow case variants of the internal click ID parameter", () => {
    const query = new URLSearchParams("CID=spoofed&cid=also-spoofed");

    expect(collectTrackingTokens(query, ["CID"])).toEqual({});
  });

  it("sets cid and approved tokens without accepting a request destination", () => {
    const destination = buildTrackingDestination(
      "https://money-site.test/offer?existing=kept&cid=old",
      "new-click-id",
      { fbclid: "abc123" },
    );

    expect(destination.toString()).toBe(
      "https://money-site.test/offer?existing=kept&cid=new-click-id&fbclid=abc123",
    );
  });

  it("rejects non-web campaign destinations", () => {
    expect(() => buildTrackingDestination("javascript:alert(1)", "cid", {})).toThrow();
  });
});
