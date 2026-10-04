import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for the dashboard reconciliation test.");
}

if (testDatabaseUrl === applicationDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}

if (!testDatabaseUrl.startsWith("postgres://") && !testDatabaseUrl.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL must use a PostgreSQL connection string.");
}

process.env.DATABASE_URL = testDatabaseUrl;

const { PrismaNeon } = await import("@prisma/adapter-neon");
const { PrismaClient } = await import("@/generated/prisma/client");
const { getCampaignDailyMetrics, getOverviewMetrics } = await import("@/lib/metrics/queries");
const { calculateDashboardMetrics } = await import("@/lib/metrics/formulas");

const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: testDatabaseUrl }) });

describe("dashboard reconciliation against persisted facts", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const from = new Date("2026-10-01T00:00:00.000Z");
  const to = new Date("2026-10-04T00:00:00.000Z");
  let campaignId: string;
  let trafficSourceId: string;
  let conversionId: string;

  beforeAll(async () => {
    const trafficSource = await database.trafficSource.create({
      data: {
        name: `Dashboard reconciliation source ${suffix}`,
        type: "test",
        configuration: { postbackUrl: "https://ads.example.test/reconciliation" },
      },
    });
    trafficSourceId = trafficSource.id;

    const campaign = await database.campaign.create({
      data: {
        slug: `dashboard-reconciliation-${suffix}`,
        name: `Dashboard reconciliation ${suffix}`,
        status: "active",
        destinationUrl: "https://money.example.test/reconciliation",
        trafficSourceId,
        defaultCurrency: "IDR",
      },
    });
    campaignId = campaign.id;

    const firstClick = await database.click.create({
      data: {
        clickId: `reconciliation-click-1-${suffix}`,
        campaignId,
        trafficSourceId,
        clickedAt: new Date("2026-10-01T10:00:00.000Z"),
        destinationUrl: "https://money.example.test/reconciliation?cid=click-1",
        trackingTokens: { click_id: "platform-click-1" },
        correlationId: randomUUID(),
      },
    });

    const secondClick = await database.click.create({
      data: {
        clickId: `reconciliation-click-2-${suffix}`,
        campaignId,
        trafficSourceId,
        clickedAt: new Date("2026-10-02T10:00:00.000Z"),
        destinationUrl: "https://money.example.test/reconciliation?cid=click-2",
        trackingTokens: { click_id: "platform-click-2" },
        correlationId: randomUUID(),
      },
    });

    const conversion = await database.conversion.create({
      data: {
        clickRecordId: secondClick.id,
        source: "reconciliation",
        eventId: `conversion-${suffix}`,
        eventType: "purchase",
        occurredAt: new Date("2026-10-02T11:00:00.000Z"),
        valueMinor: BigInt(500000),
        currency: "IDR",
        payloadHash: "a".repeat(64),
        correlationId: randomUUID(),
      },
    });
    conversionId = conversion.id;

    await database.outboundPostback.create({
      data: {
        conversionId,
        trafficSourceId,
        destination: "https://ads.example.test/reconciliation",
        status: "pending",
        correlationId: randomUUID(),
      },
    });

    // Keep the first click referenced so the fixture explicitly documents the
    // click-only day used by the reconciliation assertion.
    expect(firstClick.clickId).toContain("reconciliation-click-1");
  });

  afterAll(async () => {
    if (campaignId && trafficSourceId) {
      await database.outboundPostback.deleteMany({ where: { conversion: { click: { campaignId } } } });
      await database.conversion.deleteMany({ where: { click: { campaignId } } });
      await database.click.deleteMany({ where: { campaignId } });
      await database.campaign.deleteMany({ where: { id: campaignId } });
      await database.trafficSource.deleteMany({ where: { id: trafficSourceId } });
    }
    await database.$disconnect();
  });

  it("matches direct Prisma totals and delivery counts", async () => {
    const [directClicks, directConversions, directRevenue] = await Promise.all([
      database.click.count({ where: { campaignId, clickedAt: { gte: from, lt: to } } }),
      database.conversion.count({ where: { click: { campaignId }, occurredAt: { gte: from, lt: to } } }),
      database.conversion.aggregate({
        where: { click: { campaignId }, occurredAt: { gte: from, lt: to } },
        _sum: { valueMinor: true },
      }),
    ]);
    const directPending = await database.outboundPostback.count({
      where: {
        trafficSourceId,
        status: { in: ["pending", "processing"] },
        conversion: { click: { campaignId }, occurredAt: { gte: from, lt: to } },
      },
    });
    const overview = await getOverviewMetrics({ campaignId, from, to }, database);

    expect(overview.clicks).toBe(directClicks);
    expect(overview.conversions).toBe(directConversions);
    expect(overview.revenueMinor).toBe(Number(directRevenue._sum.valueMinor ?? BigInt(0)));
    expect(overview.pendingDeliveries).toBe(directPending);
    expect(overview.retryingDeliveries).toBe(0);
    expect(overview.permanentlyFailedDeliveries).toBe(0);
  });

  it("keeps click-only days and reconciles daily campaign metrics", async () => {
    const daily = await getCampaignDailyMetrics(campaignId, { from, to }, database);

    expect(daily).toEqual([
      {
        date: "2026-10-01",
        clicks: 1,
        conversions: 0,
        revenueMinor: 0,
        costMinor: null,
        conversionRate: 0,
        profitMinor: null,
        roi: null,
      },
      {
        date: "2026-10-02",
        clicks: 1,
        conversions: 1,
        revenueMinor: 500000,
        costMinor: null,
        conversionRate: 1,
        profitMinor: null,
        roi: null,
      },
    ]);
  });

  it("keeps ROI unavailable for missing and zero cost", () => {
    expect(calculateDashboardMetrics({ clicks: 2, conversions: 1, revenueMinor: 500000 })).toMatchObject({
      costMinor: null,
      profitMinor: null,
      roi: null,
    });
    expect(calculateDashboardMetrics({ clicks: 2, conversions: 1, revenueMinor: 500000, costMinor: 0 })).toMatchObject({
      costMinor: 0,
      profitMinor: 500000,
      roi: null,
    });
  });
});
