import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeState = {
  campaign: {
    id: string;
    destinationUrl: string;
    trafficSourceId: string | null;
    allowedTrackingParameters: string[];
  } | null;
  click: {
    id: string;
    clickId: string;
    trafficSourceId: string | null;
    trafficSource: { id: string; enabled: boolean; configuration: Record<string, unknown> } | null;
  } | null;
  conversion: { id: string; eventId: string } | null;
  outboundPostback: { id: string; destination: string } | null;
};

const state: FakeState = {
  campaign: {
    id: "campaign-1",
    destinationUrl: "https://money.example.test/checkout?source=ad",
    trafficSourceId: "source-1",
    allowedTrackingParameters: ["gclid", "campaign_id"],
  },
  click: null,
  conversion: null,
  outboundPostback: null,
};

const fakePrisma = {
  campaign: {
    findFirst: vi.fn(async () => state.campaign),
  },
  click: {
    create: vi.fn(async ({ data }: { data: { clickId: string } }) => {
      state.click = {
        id: "click-row-1",
        clickId: data.clickId,
        trafficSourceId: "source-1",
        trafficSource: {
          id: "source-1",
          enabled: true,
          configuration: { postbackUrl: "https://ads.example.test/conversion" },
        },
      };
      return state.click;
    }),
    findUnique: vi.fn(async ({ where }: { where: { clickId: string } }) =>
      state.click?.clickId === where.clickId ? state.click : null,
    ),
  },
  conversion: {
    findUnique: vi.fn(async () => (state.conversion ? { id: state.conversion.id } : null)),
    create: vi.fn(async () => {
      state.conversion = { id: "conversion-1", eventId: "order-1" };
      return { id: state.conversion.id };
    }),
  },
  outboundPostback: {
    create: vi.fn(async ({ data }: { data: { destination: string } }) => {
      state.outboundPostback = { id: "postback-1", destination: data.destination };
      return state.outboundPostback;
    }),
  },
  $transaction: vi.fn(async (callback: (transaction: typeof fakePrisma) => Promise<unknown>) => callback(fakePrisma)),
};

vi.mock("@/lib/database/prisma", () => ({ prisma: fakePrisma }));
vi.mock("@/lib/config/environment", () => ({
  getRuntimeEnvironment: () => ({ conversionWebhookSecret: "test-secret" }),
}));

const { GET } = await import("./t/[campaignSlug]/route");
const { POST } = await import("@/app/api/conversions/route");

describe("Phase 1 click-to-conversion contract", () => {
  beforeEach(() => {
    state.click = null;
    state.conversion = null;
    state.outboundPostback = null;
    vi.clearAllMocks();
  });

  it("preserves cid from redirect through conversion intake and creates one delivery record", async () => {
    const clickResponse = await GET(
      new Request("https://tracker.example.test/t/demo?gclid=google-click&ignored=secret", {
        headers: { "user-agent": "phase1-test" },
      }),
      { params: Promise.resolve({ campaignSlug: "demo" }) },
    );

    expect(clickResponse.status).toBe(302);
    const redirect = clickResponse.headers.get("location");
    expect(redirect).toBeTruthy();
    const clickUrl = new URL(redirect!);
    const cid = clickUrl.searchParams.get("cid");
    expect(cid).toBeTruthy();
    expect(clickUrl.searchParams.get("gclid")).toBe("google-click");
    expect(clickUrl.searchParams.has("ignored")).toBe(false);

    const conversionResponse = await POST(
      new Request("https://tracker.example.test/api/conversions", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cid,
          event_id: "order-1",
          event_type: "purchase",
          occurred_at: "2026-10-04T00:00:00.000Z",
          value_minor: 500000,
          currency: "IDR",
        }),
      }),
    );

    expect(conversionResponse.status).toBe(201);
    expect(await conversionResponse.json()).toMatchObject({ status: "accepted" });
    expect(state.click?.clickId).toBe(cid);
    expect(state.outboundPostback?.destination).toBe("https://ads.example.test/conversion");
  });
});
