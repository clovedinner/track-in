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
      cost: { parameter: "cost", token: "{cost}" },
    });
    expect(propeller).toMatchObject({ goalByEventType: { ftd: 2 }, cost: { parameter: "cost", token: "{cost}", enabled: true } });
  });

  it("keeps the built-in cost mapping separate from the ten custom variables", () => {
    const parameters = Array.from({ length: 10 }, (_, index) => ({
      name: `variable${index + 1}`,
      parameter: `source${index + 1}`,
      token: `{source${index + 1}}`,
      enabled: true,
    }));
    const valid = validateProviderConfiguration("propeller", {
      postbackUrl: "https://ad.propellerads.com/conversion.php",
      cost: { parameter: "cost", token: "{cost}" },
      parameters,
    });

    expect(valid).toMatchObject({ cost: { parameter: "cost", token: "{cost}" }, parameters });
    expect(() => validateProviderConfiguration("propeller", {
      postbackUrl: "https://ad.propellerads.com/conversion.php",
      cost: { parameter: "cost", token: "{cost}" },
      parameters: [...parameters, { name: "variable11", parameter: "source11", token: "{source11}", enabled: true }],
    })).toThrow(/at most 10/);
  });

  it("provides only a provider identifier for logs", () => {
    const context = safeProviderLogContext("trafficjunky");
    expect(context).toEqual({ provider: "trafficjunky" });
    expect(JSON.stringify(context)).not.toContain("secret");
  });
});
