import { describe, expect, it } from "vitest";

import {
  getProviderDefinition,
  parseProviderId,
  safeProviderLogContext,
  validateProviderConfiguration,
} from "@/lib/providers/config";

describe("provider configuration", () => {
  it("normalizes supported provider identifiers and exposes token requirements", () => {
    expect(parseProviderId(" TrafficStars ")).toBe("trafficstars");
    expect(getProviderDefinition("propeller")).toMatchObject({ label: "PropellerAds" });
    expect(getProviderDefinition("trafficjunky").requiredOriginalTokenKeys).toContain("ACLID");
  });

  it("rejects unsupported providers and malformed endpoint configuration", () => {
    expect(() => parseProviderId("google")).toThrow(/Unsupported provider/);
    expect(() => validateProviderConfiguration("propeller", { postbackUrl: "ftp://invalid.test" })).toThrow(/HTTP or HTTPS/);
    expect(() => validateProviderConfiguration("trafficjunky", {})).toThrow(/postbackUrl/);
  });

  it("validates platform-specific configuration without changing credentials", () => {
    const trafficStars = validateProviderConfiguration("trafficstars", {
      endpoint: "https://tsyndicate.com/api/v1/cpa/action",
      key: "private-key",
      allowDuplicates: true,
    });
    expect(trafficStars).toMatchObject({ endpoint: "https://tsyndicate.com/api/v1/cpa/action", key: "private-key" });

    const propeller = validateProviderConfiguration("propeller", {
      postbackUrl: "https://ad.propellerads.com/conversion.php",
      goalByEventType: { ftd: 2 },
    });
    expect(propeller).toMatchObject({ goalByEventType: { ftd: 2 } });
  });

  it("provides only a provider identifier for logs", () => {
    const context = safeProviderLogContext("trafficjunky");
    expect(context).toEqual({ provider: "trafficjunky" });
    expect(JSON.stringify(context)).not.toContain("secret");
  });
});
