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

  it("classifies missing provider context as a permanent failure", async () => {
    const result = await createProviderOutboxDelivery(successfulFetch)(baseJob({ providerId: undefined }));
    expect(result).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(successfulFetch).not.toHaveBeenCalled();
  });

  it("does not call a provider when the original token is missing", async () => {
    successfulFetch.mockClear();
    const result = await createProviderOutboxDelivery(successfulFetch)(baseJob({ clickTokens: {} }));
    expect(result).toMatchObject({ outcome: "failed", kind: "permanent" });
    expect(successfulFetch).not.toHaveBeenCalled();
  });
});
