import { describe, expect, it } from "vitest";

import {
  generateProviderPostbackTemplate,
  generateProviderPostbackTemplates,
} from "@/lib/setup/postback-templates";

describe("provider postback templates", () => {
  it.each([
    ["trafficstars", "clickid", "{click_id}"],
    ["propeller", "visitor_id", "${SUBID}"],
    ["trafficjunky", "aclid", "{ACLID}"],
  ] as const)("generates a safe %s template with its token placeholder", (provider, key, placeholder) => {
    const result = generateProviderPostbackTemplate(provider, {
      postbackUrl: "https://ads.example.test/conversion",
      ...(provider === "trafficstars" ? { key: "private-key" } : {}),
    });
    const url = new URL(result.url);
    expect(url.searchParams.get(key)).toBe(placeholder);
    expect(result.method).toBe("GET");
    expect(result.url).not.toContain("private-key");
  });

  it("redacts URL credentials while preserving existing platform macros", () => {
    const result = generateProviderPostbackTemplate("trafficjunky", {
      postbackUrl: "https://ads.example.test/postback?a=secret&member_id=123&aclid={ACLID}&custom=${ZONE_ID}",
    });
    const url = new URL(result.url);
    expect(url.searchParams.get("a")).toBe("[redacted]");
    expect(url.searchParams.get("member_id")).toBe("[redacted]");
    expect(url.searchParams.get("aclid")).toBe("{ACLID}");
    expect(url.searchParams.get("custom")).toBe("${ZONE_ID}");
    expect(result.redactedKeys).toEqual(["a", "member_id"]);
  });

  it("does not expose standalone credentials from saved configuration", () => {
    const result = generateProviderPostbackTemplate("trafficstars", {
      endpoint: "https://ads.example.test/action?key=embedded-secret",
      key: "standalone-secret",
    });
    expect(result.url).not.toContain("embedded-secret");
    expect(result.url).not.toContain("standalone-secret");
    expect(result.url).toContain("%5Bredacted%5D");
  });

  it("generates only configured providers and validates unsafe URLs", () => {
    const result = generateProviderPostbackTemplates({
      propeller: { postbackUrl: "https://ads.example.test/conversion.php" },
    });
    expect(result.trafficstars).toBeUndefined();
    expect(result.propeller?.provider).toBe("propeller");
    expect(() => generateProviderPostbackTemplate("trafficjunky", { postbackUrl: "javascript:alert(1)" })).toThrow(/HTTP or HTTPS/);
  });
});
