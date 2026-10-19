import { describe, expect, it, vi } from "vitest";

import { createProviderOutboxDelivery } from "./provider-delivery";
import type { OutboxJob } from "./worker";

const baseJob = (overrides: Partial<OutboxJob> = {}): OutboxJob => ({
  id: "job-1",
  attemptCount: 0,
  destination: "https://provider.example.test/postback",
  requestFingerprint: null,
  correlationId: "00000000-0000-0000-0000-000000000001",
  providerId: "trafficstars",
  providerConfiguration: { postbackUrl: "https://provider.example.test/postback" },
  clickTokens: { clickid: "source-click-1", SUBID: "source-sub-1", ACLID: "source-aclid-1" },
  conversion: { eventId: "event-1", eventType: "reg", valueMinor: BigInt(0), currency: "IDR" },
  ...overrides,
});

const successfulFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));

describe("provider outbox delivery", () => {
  it.each(["single", "per_event"])("delivers a generic %s URL using saved mappings and the snapshotted destination", async (postbackMode) => {
    const transport = vi.fn().mockResolvedValue({ status: 204 });
    const destination = "https://unknown.example/postback?source_id={externalid}&event={event.type}&goal=8";
    const result = await createProviderOutboxDelivery(successfulFetch, transport)(baseJob({
      providerId: "generic", destination,
      providerConfiguration: {
        externalId: { parameter: "new_key", token: "${NEW_MACRO}" }, postbackMode,
        ...(postbackMode === "single" ? { postbackUrl: "https://changed.example/new?source_id={externalid}" } : { eventPostbacks: [{ customConversionId: "00000000-0000-4000-8000-000000000001", url: "https://changed.example/new?source_id={externalid}" }] }),
      },
      clickTokens: { new_key: "original-token" },
    }));
    expect(result).toMatchObject({ outcome: "delivered", responseStatus: 204 });
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: "https://unknown.example/postback?source_id=original-token&event=reg&goal=8" }));
  });

  it.each([[400, "permanent"], [302, "permanent"], [429, "transient"], [503, "transient"]])("classifies generic HTTP %s as %s", async (status, kind) => {
    const result = await createProviderOutboxDelivery(successfulFetch, vi.fn().mockResolvedValue({ status }))(baseJob({
      providerId: "generic", destination: "https://example.com/?id={externalid}",
      providerConfiguration: { externalId: { parameter: "new_key", token: "{TOKEN}" } }, clickTokens: { new_key: "source-token" },
    }));
    expect(result).toMatchObject({ outcome: "failed", kind, responseStatus: status });
  });

  it("does not send a generic postback with missing attribution", async () => {
    const transport = vi.fn();
    const result = await createProviderOutboxDelivery(successfulFetch, transport)(baseJob({
      providerId: "generic", destination: "https://example.com/?id={externalid}",
      providerConfiguration: { externalId: { parameter: "new_key", token: "{TOKEN}" } }, clickTokens: { SUBID: "unrelated" },
    }));
    expect(result).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("redacts generic transport errors that could contain the credential-bearing URL", async () => {
    const result = await createProviderOutboxDelivery(successfulFetch, vi.fn().mockRejectedValue(new Error("https://example.com/?key=SECRET")))(baseJob({
      providerId: "generic", destination: "https://example.com/?id={externalid}",
      providerConfiguration: { externalId: { parameter: "new_key", token: "{TOKEN}" } }, clickTokens: { new_key: "source-token" },
    }));
    expect(result).toMatchObject({ outcome: "failed", kind: "transient" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it.each([
    ["trafficstars", "clickid=source-click-1"],
    ["propeller", "visitor_id=source-sub-1"],
    ["trafficjunky", "aclid=source-aclid-1"],
  ])("builds and sends the %s request with the original token", async (providerId, expected) => {
    successfulFetch.mockClear();
    const deliver = createProviderOutboxDelivery(successfulFetch);
    const result = await deliver(baseJob({
      providerId,
      providerConfiguration: { postbackUrl: "https://provider.example.test/postback" },
    }));

    expect(result.outcome).toBe("delivered");
    expect(String(successfulFetch.mock.calls[0]?.[0])).toContain(expected);
  });

  it("uses the configured TrafficStars external-ID parameter", async () => {
    successfulFetch.mockClear();
    const deliver = createProviderOutboxDelivery(successfulFetch);
    const result = await deliver(baseJob({
      providerId: "trafficstars",
      providerConfiguration: {
        postbackUrl: "https://provider.example.test/postback",
        externalId: { parameter: "externalid", token: "{externalid}" },
      },
      clickTokens: { externalid: "real-source-token" },
    }));

    expect(result.outcome).toBe("delivered");
    expect(String(successfulFetch.mock.calls[0]?.[0])).toContain("clickid=real-source-token");
  });

  it("classifies missing provider context as a permanent failure", async () => {
    const result = await createProviderOutboxDelivery(successfulFetch)(baseJob({ providerId: undefined }));
    expect(result).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(successfulFetch).not.toHaveBeenCalled();
  });

  it.each(["single", "per_event"])("delivers Propeller %s postbacks using the configured visitor_id", async (postbackMode) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const destination = "https://provider.example.test/postback?aid=account-1&visitor_id={externalid}";
    const result = await createProviderOutboxDelivery(fetchImpl)(baseJob({
      providerId: "propeller",
      destination,
      providerConfiguration: {
        postbackMode,
        ...(postbackMode === "single" ? { postbackUrl: destination } : {
          eventPostbacks: [{ customConversionId: "00000000-0000-4000-8000-000000000002", url: destination }],
        }),
        externalId: { parameter: "visitor_id", token: "${SUBID}", enabled: true },
      },
      clickTokens: { visitor_id: "1135905635428167681" },
    }));

    expect(result).toMatchObject({ outcome: "delivered", responseStatus: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const sentUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(sentUrl.searchParams.get("visitor_id")).toBe("1135905635428167681");
    expect(sentUrl.searchParams.get("aid")).toBe("account-1");
  });

  it("does not send a different Propeller token when the configured parameter is absent", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await createProviderOutboxDelivery(fetchImpl)(baseJob({
      providerId: "propeller",
      providerConfiguration: {
        postbackUrl: "https://provider.example.test/postback",
        externalId: { parameter: "visitor_id", token: "${SUBID}" },
      },
      clickTokens: { SUBID: "different-click" },
    }));

    expect(result).toMatchObject({ outcome: "failed", kind: "permanent", error: expect.stringMatching(/configured parameter.*visitor_id/) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call a provider when the original token is missing", async () => {
    successfulFetch.mockClear();
    const result = await createProviderOutboxDelivery(successfulFetch)(baseJob({ clickTokens: {} }));
    expect(result).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(successfulFetch).not.toHaveBeenCalled();
  });
});
