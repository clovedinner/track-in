import { describe, expect, it } from "vitest";

import { buildCampaignTrackingScript } from "./campaign-tracking-script";

describe("campaign tracking install script", () => {
  it("points the Voluum-compatible loader at the configured tracker origin", () => {
    const script = buildCampaignTrackingScript("https://tracker.example.test/");
    expect(script).toContain("https://tracker.example.test/g/.js");
    expect(script).toContain("/g/click?cpid=");
    expect(script).toContain("trackin_cid_ready");
    expect(script).toContain("replaceState");
    expect(script).toContain("<meta http-equiv=\"delegate-ch\"");
    expect(script).toContain("<noscript>");
  });

  it("rejects non-HTTP tracker origins", () => {
    expect(() => buildCampaignTrackingScript("javascript:alert(1)")).toThrow(/HTTP or HTTPS/);
  });
});
