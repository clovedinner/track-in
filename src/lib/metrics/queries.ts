import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { calculateDashboardMetrics, type DashboardMetrics } from "./formulas";

export type DashboardFilters = {
  from?: Date;
  to?: Date;
  campaignId?: string;
  trafficSourceId?: string;
  eventType?: string;
};

export type DashboardDb = Pick<PrismaClient, "click" | "conversion" | "outboundPostback">;

export type OverviewMetrics = DashboardMetrics & {
  pendingDeliveries: number;
  retryingDeliveries: number;
  permanentlyFailedDeliveries: number;
};

export type DailyMetric = DashboardMetrics & { date: string };

const deliveryStatuses = ["pending", "processing", "retryable_failed", "permanently_failed"] as const;

function dateWhere(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
}

function clickWhere(filters: DashboardFilters): Prisma.ClickWhereInput {
  return {
    clickedAt: dateWhere(filters.from, filters.to),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}),
  };
}

function conversionWhere(filters: DashboardFilters): Prisma.ConversionWhereInput {
  return {
    occurredAt: dateWhere(filters.from, filters.to),
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    click: {
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}),
    },
  };
}

function bigintToNumber(value: bigint | null | undefined, field: string): number {
  if (value === null || value === undefined) return 0;
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${field} exceeds the dashboard numeric range.`);
  }
  return numberValue;
}

export async function getOverviewMetrics(
  filters: DashboardFilters = {},
  db?: DashboardDb,
): Promise<OverviewMetrics> {
  const database = db ?? (await import("@/lib/database/prisma")).prisma;
  const clickFilter = clickWhere(filters);
  const conversionFilter = conversionWhere(filters);
  const [clicks, conversionAggregate, pendingDeliveries, retryingDeliveries, permanentlyFailedDeliveries] =
    await Promise.all([
      database.click.count({ where: clickFilter }),
      database.conversion.aggregate({ where: conversionFilter, _count: { _all: true }, _sum: { valueMinor: true } }),
      database.outboundPostback.count({ where: { status: { in: ["pending", "processing"] }, conversion: { occurredAt: dateWhere(filters.from, filters.to), click: { ...(filters.campaignId ? { campaignId: filters.campaignId } : {}), ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}) } } } }),
      database.outboundPostback.count({ where: { status: "retryable_failed", conversion: { occurredAt: dateWhere(filters.from, filters.to), click: { ...(filters.campaignId ? { campaignId: filters.campaignId } : {}), ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}) } } } }),
      database.outboundPostback.count({ where: { status: "permanently_failed", conversion: { occurredAt: dateWhere(filters.from, filters.to), click: { ...(filters.campaignId ? { campaignId: filters.campaignId } : {}), ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}) } } } }),
    ]);
  const metrics = calculateDashboardMetrics({
    clicks,
    conversions: conversionAggregate._count._all,
    revenueMinor: bigintToNumber(conversionAggregate._sum.valueMinor, "revenue"),
  });
  return { ...metrics, pendingDeliveries, retryingDeliveries, permanentlyFailedDeliveries };
}

export async function getCampaignDailyMetrics(
  campaignId: string,
  filters: Omit<DashboardFilters, "campaignId"> = {},
  db?: DashboardDb,
): Promise<DailyMetric[]> {
  const database = db ?? (await import("@/lib/database/prisma")).prisma;
  const clickRows = await database.click.findMany({ where: clickWhere({ ...filters, campaignId }), select: { clickedAt: true } });
  const conversionRows = await database.conversion.findMany({
    where: conversionWhere({ ...filters, campaignId }),
    select: { occurredAt: true, valueMinor: true },
  });
  const days = new Map<string, { clicks: number; conversions: number; revenueMinor: number }>();
  const ensure = (date: string) => days.get(date) ?? (days.set(date, { clicks: 0, conversions: 0, revenueMinor: 0 }), days.get(date)!);
  for (const row of clickRows) ensure(row.clickedAt.toISOString().slice(0, 10)).clicks += 1;
  for (const row of conversionRows) {
    const day = ensure(row.occurredAt.toISOString().slice(0, 10));
    day.conversions += 1;
    day.revenueMinor += bigintToNumber(row.valueMinor, "revenue");
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, facts]) => ({
    date,
    ...calculateDashboardMetrics(facts),
  }));
}

export { deliveryStatuses };
