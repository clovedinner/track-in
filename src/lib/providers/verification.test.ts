import { describe, expect, it } from "vitest";
import { buildProviderVerificationPlan, verifyProvidersDryRun } from "@/lib/providers/verification";

describe("provider verification", () => {
  it("verifies generic saved mappings and redacts path tokens without a network call", () => {
    const plan = buildProviderVerificationPlan({ providerId: "generic", configuration: {
      postbackUrl: "https://example.com/{externalid}?event={event.type}&key=secret",
      externalId: { parameter: "custom_key", token: "${NEW_TOKEN}" },
    }, sampleTokens: { custom_key: "original-sensitive-token" } });
    expect(plan.externalCall).toBe(false);
    expect(plan.requiredTokenFound).toBe(true);
    expect(plan.redactedUrl).not.toContain("original-sensitive-token");
    expect(plan.redactedUrl).not.toContain("secret");
  });

  it("builds a fully redacted dry-run plan without network access", () => {
    const plan = buildProviderVerificationPlan({
      providerId: "trafficstars",
      configuration: { postbackUrl: "https://tsyndicate.example.test/cpa?action=secret" },
      sampleTokens: { clickid: "real-click-token" },
    });

    expect(plan.externalCall).toBe(false);
    expect(plan.method).toBe("GET");
    expect(plan.requiredTokenFound).toBe(true);
    expect(plan.redactedUrl).not.toContain("real-click-token");
    expect(plan.redactedUrl).not.toContain("secret");
    expect(plan.queryKeys).toContain("clickid");
  });

  it("checks all supported providers without contacting them", () => {
    const plans = verifyProvidersDryRun([
      { providerId: "trafficstars", configuration: { postbackUrl: "https://example.test/ts" }, sampleTokens: { clickid: "ts" } },
      { providerId: "propeller", configuration: { postbackUrl: "https://example.test/prop" }, sampleTokens: { SUBID: "prop" } },
      { providerId: "trafficjunky", configuration: { postbackUrl: "https://example.test/tj?a=secret" }, sampleTokens: { ACLID: "tj" } },
    ]);

    expect(plans.map((plan) => plan.provider)).toEqual(["trafficstars", "propeller", "trafficjunky"]);
    expect(plans.every((plan) => plan.externalCall === false && plan.requiredTokenFound)).toBe(true);
    expect(plans[2].redactedUrl).not.toContain("secret");
  });

  it("fails closed when the original provider token is missing", () => {
    expect(() => buildProviderVerificationPlan({
      providerId: "trafficjunky",
      configuration: { postbackUrl: "https://example.test/tj" },
      sampleTokens: { cid: "internal-only" },
    })).toThrow(/ACLID/);
  });
});
