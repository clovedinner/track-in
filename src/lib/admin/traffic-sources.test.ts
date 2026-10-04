import { describe, expect, it } from "vitest";
import { parseTrafficSourceInput, safeTrafficSourceConfiguration } from "./traffic-sources";

describe("traffic source administration", () => {
  it("validates provider-specific configuration", () => {
    expect(parseTrafficSourceInput({ name: "Propeller", type: "propeller", configuration: { postbackUrl: "https://example.test/conversion.php" } }).type).toBe("propeller");
    expect(() => parseTrafficSourceInput({ name: "Bad", type: "propeller", configuration: { postbackUrl: "javascript:alert(1)" } })).toThrow();
  });

  it("returns safe configuration metadata without credentials", () => {
    const safe = safeTrafficSourceConfiguration({ postbackUrl: "https://example.test/p?key=secret&member_id=abc", key: "secret", aid: "123" });
    expect(safe).toEqual({ postbackUrl: "https://example.test/p?key=%5Bredacted%5D&member_id=%5Bredacted%5D", aid: "123" });
  });
});
