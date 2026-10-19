import { describe, expect, it } from "vitest";
import { parseTrafficSourceInput, preserveMaskedPostbackValues, safeTrafficSourceConfiguration } from "./traffic-sources";

describe("traffic source administration", () => {
  it("preserves masked postback credentials when editing without exposing them to the browser", () => {
    const previous = { postbackUrl: "https://example.com/p?key=secret&id={externalid}", externalId: { parameter: "custom_key", token: "${NEW_MACRO}" } };
    const next = { ...previous, postbackUrl: "https://example.com/p?key=%5Bredacted%5D&id={externalid}&goal=8" };
    const restored = preserveMaskedPostbackValues(next, previous);
    const url = new URL(restored.postbackUrl!);
    expect(url.searchParams.get("key")).toBe("secret");
    expect(url.searchParams.get("goal")).toBe("8");
    expect(safeTrafficSourceConfiguration(restored).postbackUrl).not.toContain("secret");
  });

  it("matches masked credentials by event identity rather than event order", () => {
    const previous = { eventPostbacks: [{ customConversionId: "reg", url: "https://example.com/p?key=reg-secret" }, { customConversionId: "ftd", url: "https://example.com/p?key=ftd-secret" }] };
    const next = { eventPostbacks: [{ customConversionId: "ftd", url: "https://example.com/p?key=[redacted]" }] };
    expect(preserveMaskedPostbackValues(next, previous).eventPostbacks?.[0].url).toContain("ftd-secret");
  });

  it("does not copy a masked credential to a different host or endpoint", () => {
    expect(() => preserveMaskedPostbackValues({ postbackUrl: "https://other.example/p?key=[redacted]" }, { postbackUrl: "https://example.com/p?key=secret" })).toThrow(/real credentials/);
  });

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
