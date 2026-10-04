import { beforeAll, afterAll, describe, expect, it } from "vitest";

// This suite deliberately uses a separately supplied database URL. Never point it
// at the application's DATABASE_URL: the guard is repeated here because this
// file replaces DATABASE_URL before importing the route handlers.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for the Phase 1 integration test.");
}

if (testDatabaseUrl === applicationDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}

if (!testDatabaseUrl.startsWith("postgres://") && !testDatabaseUrl.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL must use a PostgreSQL connection string.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.CONVERSION_WEBHOOK_SECRET = "phase1-integration-secret";

const { PrismaNeon } = await import("@prisma/adapter-neon");
const { PrismaClient } = await import("@/generated/prisma/client");
const { GET } = await import("@/app/t/[campaignSlug]/route");
const { POST } = await import("@/app/api/conversions/route");
const { GET: postbackGET } = await import("@/app/postback/route");

const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: testDatabaseUrl }) });

describe("Phase 1 database-backed click-to-conversion flow", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `phase1-${suffix}`;
  let campaignId: string;
  let trafficSourceId: string;
  let clickId: string;
  let conversionId: string;

  beforeAll(async () => {
    const trafficSource = await database.trafficSource.create({
      data: {
        name: `Phase 1 test source ${suffix}`,
        type: "test",
        configuration: { postbackUrl: "https://ads.example.test/conversion" },
      },
    });
    trafficSourceId = trafficSource.id;

    const campaign = await database.campaign.create({
      data: {
        slug,
        name: `Phase 1 test campaign ${suffix}`,
        status: "active",
        destinationUrl: "https://money.example.test/checkout?source=phase1",
        trafficSourceId: trafficSource.id,
        defaultCurrency: "IDR",
        allowedTrackingParameters: ["gclid", "campaign_id"],
      },
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    // Delete only rows created by this run. Foreign keys require child-first cleanup.
    if (!campaignId || !trafficSourceId) {
      await database.$disconnect();
      return;
    }
    await database.outboundPostback.deleteMany({ where: { conversion: { click: { campaignId } } } });
    await database.conversion.deleteMany({ where: { click: { campaignId } } });
    await database.click.deleteMany({ where: { campaignId } });
    await database.campaign.deleteMany({ where: { id: campaignId } });
    await database.trafficSource.deleteMany({ where: { id: trafficSourceId } });
    await database.$disconnect();
  });

  it("persists attribution, creates one outbox row, and treats replay as duplicate", async () => {
    const clickResponse = await GET(
      new Request(`https://tracker.example.test/t/${slug}?gclid=test-gclid&ignored=secret`, {
        headers: { "user-agent": "phase1-integration" },
      }),
      { params: Promise.resolve({ campaignSlug: slug }) },
    );

    expect(clickResponse.status).toBe(302);
    const redirect = clickResponse.headers.get("location");
    expect(redirect).toBeTruthy();
    const destination = new URL(redirect!);
    clickId = destination.searchParams.get("cid") ?? "";
    expect(clickId).toBeTruthy();
    expect(destination.searchParams.get("gclid")).toBe("test-gclid");
    expect(destination.searchParams.has("ignored")).toBe(false);

    const click = await database.click.findUnique({ where: { clickId } });
    expect(click?.campaignId).toBe(campaignId);

    const payload = {
      cid: clickId,
      event_id: `order-${suffix}`,
      event_type: "purchase",
      occurred_at: "2026-10-04T00:00:00.000Z",
      value_minor: 500000,
      currency: "IDR",
    };
    const headers = {
      authorization: "Bearer phase1-integration-secret",
      "content-type": "application/json",
    };

    const accepted = await POST(
      new Request("https://tracker.example.test/api/conversions", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
    expect(accepted.status).toBe(201);
    const acceptedBody = await accepted.json();
    expect(acceptedBody.status).toBe("accepted");
    conversionId = acceptedBody.conversion_id;

    const replay = await POST(
      new Request("https://tracker.example.test/api/conversions", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ status: "duplicate", conversion_id: conversionId });

    expect(await database.conversion.count({ where: { id: conversionId } })).toBe(1);
    expect(await database.outboundPostback.count({ where: { conversionId } })).toBe(1);
  });

  it("accepts Voluum-compatible registration and FTD postbacks with txid idempotency", async () => {
    expect(clickId).toBeTruthy();

    const registrationUrl = new URL("https://tracker.example.test/postback");
    registrationUrl.searchParams.set("cid", clickId);
    registrationUrl.searchParams.set("et", "reg");
    registrationUrl.searchParams.set("payout", "12500");
    registrationUrl.searchParams.set("currency", "IDR");

    const registration = await postbackGET(new Request(registrationUrl));
    expect(registration.status).toBe(200);
    expect(registration.headers.get("content-type")).toContain("image/gif");

    const duplicateRegistration = await postbackGET(new Request(registrationUrl));
    expect(duplicateRegistration.status).toBe(200);

    const ftdUrl = new URL("https://tracker.example.test/postback");
    ftdUrl.searchParams.set("cid", clickId);
    ftdUrl.searchParams.set("et", "ftd");
    ftdUrl.searchParams.set("txid", `ftd-${suffix}`);
    ftdUrl.searchParams.set("value", "500000");
    ftdUrl.searchParams.set("currency", "IDR");

    const ftd = await postbackGET(new Request(ftdUrl));
    expect(ftd.status).toBe(200);

    const duplicateFtd = await postbackGET(new Request(ftdUrl));
    expect(duplicateFtd.status).toBe(200);

    const conversions = await database.conversion.findMany({
      where: { source: "voluum_compat", eventId: { startsWith: `voluum:${clickId}:` } },
      orderBy: { receivedAt: "asc" },
      select: { eventType: true, eventId: true, transactionReference: true, id: true },
    });
    const testConversions = conversions.filter((conversion) => conversion.eventId.includes(clickId));

    expect(testConversions).toHaveLength(2);
    expect(testConversions.map((conversion) => conversion.eventType)).toEqual(["reg", "ftd"]);
    expect(testConversions.find((conversion) => conversion.eventType === "reg")?.transactionReference).toBeNull();
    expect(testConversions.find((conversion) => conversion.eventType === "ftd")?.transactionReference).toBe(`ftd-${suffix}`);

    const postbackCount = await database.outboundPostback.count({
      where: { conversion: { id: { in: testConversions.map((conversion) => conversion.id) } } },
    });
    expect(postbackCount).toBe(2);
  });
});
