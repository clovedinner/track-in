import { describe, expect, it } from "vitest";

import {
  buildTrackingDestination,
  collectTrackingTokens,
  createClickId,
} from "./click";

describe("click tracking helpers", () => {
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
