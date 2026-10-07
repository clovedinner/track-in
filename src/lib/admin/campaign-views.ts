import { Prisma, type CampaignStatus } from "@/generated/prisma/client";

import { prisma } from "@/lib/database/prisma";
import { getCampaignDailyMetrics, getOverviewMetrics, type DashboardFilters, type DailyMetric, type OverviewMetrics } from "@/lib/metrics/queries";

export type CampaignListSort = "name" | "createdAt" | "clicks" | "conversions";

export type CampaignListFilters = {
  search?: string;
  status?: CampaignStatus;
  sort?: CampaignListSort;
  direction?: "asc" | "desc";
};

export type CampaignListRow = {
  id: string;
  slug: string;
  name: string;
  status: CampaignStatus;
  destinationUrl: string;
  defaultCurrency: string;
  trafficSourceName: string | null;
  createdAt: Date;
  clicks: number;
  conversions: number;
  revenueMinor: number;
  registrations: number;
  ftds: number;
};

export type CampaignDetail = {
  campaign: {
    id: string;
    slug: string;
    name: string;
    status: CampaignStatus;
    destinationUrl: string;
    defaultCurrency: string;
    trafficSourceName: string | null;
  };
  metrics: OverviewMetrics;
  dailyMetrics: DailyMetric[];
  recentClicks: Array<{
    clickId: string;
    clickedAt: Date;
    destinationUrl: string;
    trackingTokens: Prisma.JsonValue;
  }>;
  recentConversions: Array<{
    id: string;
    eventType: string;
    eventId: string;
    occurredAt: Date;
    receivedAt: Date;
    valueMinor: bigint;
    currency: string;
    outboundPostbacks: Array<{ status: string; lastError: string | null }>;
  }>;
  deliveryFailures: Array<{
    id: string;
    status: string;
    attemptCount: number;
    lastError: string | null;
    updatedAt: Date;
    conversion: { eventType: string; eventId: string };
  }>;
};

const allowedStatuses = new Set<CampaignStatus>(["active", "paused", "archived"]);
const allowedSorts = new Set<CampaignListSort>(["name", "createdAt", "clicks", "conversions"]);

export function parseCampaignListFilters(params: URLSearchParams): CampaignListFilters {
  const status = params.get("status");
  const sort = params.get("sort");
  const direction = params.get("direction");

  return {
    search: params.get("q")?.trim().slice(0, 100) || undefined,
    status: status && allowedStatuses.has(status as CampaignStatus) ? status as CampaignStatus : undefined,
    sort: sort && allowedSorts.has(sort as CampaignListSort) ? sort as CampaignListSort : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
  };
}

function bigintToNumber(value: bigint): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) throw new Error("Campaign revenue exceeds the dashboard numeric range.");
  return numberValue;
}

export async function getCampaignList(filters: CampaignListFilters = {}): Promise<CampaignListRow[]> {
  const campaignRows = await prisma.campaign.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { slug: { contains: filters.search, mode: "insensitive" } }] } : {}),
    },
    orderBy: filters.sort === "name" ? { name: filters.direction ?? "desc" } : { createdAt: filters.direction ?? "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      destinationUrl: true,
      defaultCurrency: true,
      createdAt: true,
      trafficSource: { select: { name: true } },
      clicks: { select: { conversions: { select: { valueMinor: true, eventType: true } } } },
    },
  });

  const rows = campaignRows.map((campaign) => {
    const conversions = campaign.clicks.flatMap((click) => click.conversions);
    return {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      destinationUrl: campaign.destinationUrl,
      defaultCurrency: campaign.defaultCurrency,
      trafficSourceName: campaign.trafficSource?.name ?? null,
      createdAt: campaign.createdAt,
      clicks: campaign.clicks.length,
      conversions: conversions.length,
      revenueMinor: conversions.reduce((total, conversion) => total + bigintToNumber(conversion.valueMinor), 0),
      registrations: conversions.filter((conversion) => conversion.eventType.toLowerCase() === "registration").length,
      ftds: conversions.filter((conversion) => ["ftd", "first_deposit", "first-deposit"].includes(conversion.eventType.toLowerCase())).length,
    } satisfies CampaignListRow;
  });

  if (filters.sort === "clicks" || filters.sort === "conversions") {
    const multiplier = filters.direction === "asc" ? 1 : -1;
    const field = filters.sort;
    rows.sort((left, right) => (left[field] - right[field]) * multiplier);
  }
  return rows;
}

function detailDateFilters(params: URLSearchParams): DashboardFilters {
  const fromValue = params.get("from");
  const toValue = params.get("to");
  const from = fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : undefined;
  const to = toValue ? new Date(`${toValue}T00:00:00.000Z`) : undefined;
  return {
    from: from && !Number.isNaN(from.valueOf()) ? from : undefined,
    to: to && !Number.isNaN(to.valueOf()) ? to : undefined,
    eventType: params.get("eventType")?.trim().slice(0, 100) || undefined,
  };
}

export function campaignDetailFilters(params: URLSearchParams): DashboardFilters {
  return detailDateFilters(params);
}

export async function getCampaignDetail(campaignId: string, filters: DashboardFilters = {}): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      destinationUrl: true,
      defaultCurrency: true,
      trafficSource: { select: { name: true } },
    },
  });
  if (!campaign) return null;

  const [metrics, dailyMetrics, recentClicks, recentConversions, deliveryFailures] = await Promise.all([
    getOverviewMetrics({ ...filters, campaignId }),
    getCampaignDailyMetrics(campaignId, filters),
    prisma.click.findMany({
      where: { campaignId, clickedAt: filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } : undefined },
      orderBy: { clickedAt: "desc" },
      take: 25,
      select: { clickId: true, clickedAt: true, destinationUrl: true, trackingTokens: true },
    }),
    prisma.conversion.findMany({
      where: { click: { campaignId }, ...(filters.eventType ? { eventType: filters.eventType } : {}), occurredAt: filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } : undefined },
      orderBy: { receivedAt: "desc" },
      take: 25,
      select: { id: true, eventType: true, eventId: true, occurredAt: true, receivedAt: true, valueMinor: true, currency: true, outboundPostbacks: { select: { status: true, lastError: true } } },
    }),
    prisma.outboundPostback.findMany({
      where: { status: { in: ["retryable_failed", "permanently_failed"] }, conversion: { click: { campaignId } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, status: true, attemptCount: true, lastError: true, updatedAt: true, conversion: { select: { eventType: true, eventId: true } } },
    }),
  ]);

  return {
    campaign: { ...campaign, trafficSourceName: campaign.trafficSource?.name ?? null },
    metrics,
    dailyMetrics,
    recentClicks,
    recentConversions,
    deliveryFailures,
  };
}
