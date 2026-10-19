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

  it("keeps editable traffic-source settings while sanitizing postback URLs", () => {
    const safe = safeTrafficSourceConfiguration({
      postbackMode: "per_event",
      externalId: { parameter: "SUBID", token: "${SUBID}", enabled: true },
      parameters: [{ name: "Site", parameter: "site_id", token: "{site_id}", enabled: true }],
      eventPostbacks: [{ customConversionId: "event-1", url: "https://example.test/postback?key=secret&cid={externalid}" }],
    });

    expect(safe).toMatchObject({
      postbackMode: "per_event",
      externalId: { parameter: "SUBID", token: "${SUBID}", enabled: true },
      parameters: [{ name: "Site", parameter: "site_id", token: "{site_id}", enabled: true }],
      eventPostbacks: [{ customConversionId: "event-1", url: "https://example.test/postback?key=%5Bredacted%5D&cid={externalid}" }],
    });
  });
});
