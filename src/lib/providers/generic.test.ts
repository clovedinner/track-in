import { describe, expect, it } from "vitest";
import { buildGenericPostbackRequest, validateGenericPostbackTemplate } from "./generic";
import { validateProviderConfiguration, type GenericProviderConfiguration } from "./config";
import { parseTrafficSourceInput } from "@/lib/admin/traffic-sources";

const configuration: GenericProviderConfiguration = {
  postbackUrl: "https://unrecognized.example/postback?click_token={externalid}&event={event.type}&amount={payout}&key=keep-me",
  externalId: { parameter: "client_chosen_key", token: "${NEW_PLATFORM_MACRO}" },
  cost: { parameter: "source_price", token: "{NEW_PRICE}" },
  parameters: [{ name: "zone", parameter: "zone_key", token: "{NEW_ZONE}" }],
};
const conversion = { eventId: "event-1", eventType: "deposit", valueMinor: BigInt(12345), currency: "USD", clickId: "tracker-visit", transactionReference: "order-1" };
const tokens = { client_chosen_key: "original-source-token", source_price: "0.07", zone_key: "zone-8" };

describe("saved postback templates", () => {
  it("accepts unknown incoming macros without guessing a provider", () => {
    const input = parseTrafficSourceInput({ name: "New network", configuration });
    expect(input.type).toBe("generic");
    expect(input.configuration.externalId).toEqual({ parameter: "client_chosen_key", token: "${NEW_PLATFORM_MACRO}", enabled: true });
    const url = new URL(buildGenericPostbackRequest(input.configuration, tokens, conversion).url);
    expect(Object.fromEntries(url.searchParams)).toEqual({ click_token: "original-source-token", event: "deposit", amount: "123.45", key: "keep-me" });
    expect(url.searchParams.has("visitor_id")).toBe(false);
    expect(url.searchParams.has("lead_code")).toBe(false);
  });

  it("expands configured macro aliases, variables, explicit parameters, and conversion fields", () => {
    const url = new URL(buildGenericPostbackRequest({ ...configuration, postbackUrl: "https://example.com/p?a=${NEW_PLATFORM_MACRO}&b={var1}&c={param.zone_key}&d={NEW_ZONE}&cost={cost}&tx={transaction.id}&visit={clickid}&id={event.id}&minor={payout.minor}&currency={payout.currency}" }, tokens, conversion).url);
    expect(Object.fromEntries(url.searchParams)).toEqual({ a: "original-source-token", b: "zone-8", c: "zone-8", d: "zone-8", cost: "0.07", tx: "order-1", visit: "tracker-visit", id: "event-1", minor: "12345", currency: "USD" });
  });

  it("encodes token values without allowing query or path injection and preserves repeated keys", () => {
    const url = new URL(buildGenericPostbackRequest({ ...configuration, postbackUrl: "https://example.com/event/{externalid}?id={externalid}&x=one&x=two" }, { client_chosen_key: "a/b?key=stolen&goal=9#x" }, conversion).url);
    expect(url.pathname).toBe("/event/a%2Fb%3Fkey%3Dstolen%26goal%3D9%23x");
    expect(url.searchParams.get("id")).toBe("a/b?key=stolen&goal=9#x");
    expect(url.searchParams.getAll("x")).toEqual(["one", "two"]);
    expect(url.searchParams.has("goal")).toBe(false);
  });

  it.each(["", "${NEW_PLATFORM_MACRO}", "{anything}"])("rejects missing or unexpanded source tokens: %s", (value) => {
    expect(() => buildGenericPostbackRequest(configuration, { client_chosen_key: value, subid: "must-not-fallback" }, conversion)).toThrow(/captured value/);
  });

  it("does not substitute tracker IDs or legacy provider keys for the configured external ID", () => {
    expect(() => buildGenericPostbackRequest(configuration, { SUBID: "legacy", cid: "internal" }, conversion)).toThrow(/client_chosen_key/);
  });

  it.each(["https://example.com/p?token={typo}", "https://example.com/p?{externalid}=value", "https://example.com/{incomplete", "https://user:secret@example.com/p", "https://example.com/p#fragment"])("rejects invalid templates at save time", (postbackUrl) => {
    expect(() => validateProviderConfiguration("generic", { ...configuration, postbackUrl })).toThrow();
  });

  it.each([["JPY", "12345"], ["USD", "123.45"], ["KWD", "12.345"]])("formats %s minor units exactly", (currency, expected) => {
    const url = new URL(buildGenericPostbackRequest(configuration, tokens, { ...conversion, currency }).url);
    expect(url.searchParams.get("amount")).toBe(expected);
  });

  it("does not access disabled custom mappings", () => {
    expect(() => buildGenericPostbackRequest({ ...configuration, parameters: [{ name: "zone", parameter: "zone_key", token: "{NEW_ZONE}", enabled: false }], postbackUrl: "https://example.com/?zone={var1}" }, tokens, conversion)).toThrow(/mapping/);
  });

  it("supports up to ten custom fields in addition to external ID and cost", () => {
    const parameters = Array.from({ length: 10 }, (_, index) => ({ name: `field${index}`, parameter: `key${index}`, token: `{MACRO${index}}` }));
    expect(() => validateProviderConfiguration("generic", { ...configuration, parameters, postbackUrl: "https://example.com/?v={var10}" })).not.toThrow();
  });

  it("validates without requesting sample token values or contacting an endpoint", () => {
    expect(() => validateGenericPostbackTemplate(configuration.postbackUrl!, configuration)).not.toThrow();
  });
});
