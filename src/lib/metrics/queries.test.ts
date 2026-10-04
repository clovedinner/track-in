import { describe, expect, it, vi } from "vitest";

import { getCampaignDailyMetrics, getOverviewMetrics, type DashboardDb } from "./queries";

function mockDb(overrides: Partial<Record<keyof DashboardDb, unknown>> = {}): DashboardDb {
  return {
    click: { count: vi.fn(), findMany: vi.fn(), ...((overrides.click ?? {}) as object) },
    conversion: { aggregate: vi.fn(), findMany: vi.fn(), ...((overrides.conversion ?? {}) as object) },
    outboundPostback: { count: vi.fn(), ...((overrides.outboundPostback ?? {}) as object) },
  } as unknown as DashboardDb;
}

describe("dashboard metric queries", () => {
  it("applies overview filters and derives persisted revenue metrics", async () => {
    const clickCount = vi.fn().mockResolvedValue(20);
    const aggregate = vi.fn().mockResolvedValue({ _count: { _all: 3 }, _sum: { valueMinor: BigInt("125000") } });
    const deliveryCount = vi.fn().mockResolvedValue(1);
    const db = mockDb({
      click: { count: clickCount },
      conversion: { aggregate },
      outboundPostback: { count: deliveryCount },
    });
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-02T00:00:00Z");

    await expect(getOverviewMetrics({ from, to, campaignId: "campaign-1", trafficSourceId: "source-1", eventType: "ftd" }, db))
      .resolves.toMatchObject({ clicks: 20, conversions: 3, revenueMinor: 125000, conversionRate: 0.15, pendingDeliveries: 1 });

    expect(clickCount).toHaveBeenCalledWith({ where: expect.objectContaining({ campaignId: "campaign-1", trafficSourceId: "source-1", clickedAt: { gte: from, lt: to } }) });
    expect(aggregate).toHaveBeenCalledWith({ where: expect.objectContaining({ eventType: "ftd", occurredAt: { gte: from, lt: to } }), _count: { _all: true }, _sum: { valueMinor: true } });
    expect(deliveryCount).toHaveBeenCalledTimes(3);
  });

  it("groups campaign facts by UTC day and keeps days with only clicks", async () => {
    const db = mockDb({
      click: { findMany: vi.fn().mockResolvedValue([
        { clickedAt: new Date("2026-10-01T23:30:00Z") },
        { clickedAt: new Date("2026-10-02T02:00:00Z") },
      ]) },
      conversion: { findMany: vi.fn().mockResolvedValue([
        { occurredAt: new Date("2026-10-01T03:00:00Z"), valueMinor: BigInt("500") },
      ]) },
    });

    await expect(getCampaignDailyMetrics("campaign-1", {}, db)).resolves.toEqual([
      expect.objectContaining({ date: "2026-10-01", clicks: 1, conversions: 1, revenueMinor: 500 }),
      expect.objectContaining({ date: "2026-10-02", clicks: 1, conversions: 0, revenueMinor: 0 }),
    ]);
  });
});
