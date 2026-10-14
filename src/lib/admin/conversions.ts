import { prisma } from "@/lib/database/prisma";

export type ConversionFilters = {
  ownerId?: string;
  from?: Date;
  to?: Date;
  campaignId?: string;
  trafficSourceId?: string;
  eventType?: string;
  query?: string;
};

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function getConversionWorkspace(filters: ConversionFilters = {}) {
  const eventType = filters.eventType?.trim();
  const query = filters.query?.trim();
  const conversions = await prisma.conversion.findMany({
    where: {
      ...(filters.from || filters.to ? { receivedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } } : {}),
      ...(eventType ? { eventType: { equals: eventType, mode: "insensitive" } } : {}),
      click: {
        ...(filters.ownerId ? { campaign: { ownerId: filters.ownerId } } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.trafficSourceId ? { trafficSourceId: filters.trafficSourceId } : {}),
        ...(query ? { OR: [{ clickId: { contains: query, mode: "insensitive" } }, { campaign: { name: { contains: query, mode: "insensitive" } } }] } : {}),
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 250,
    select: {
      id: true,
      source: true,
      eventId: true,
      eventType: true,
      occurredAt: true,
      receivedAt: true,
      valueMinor: true,
      currency: true,
      validationState: true,
      transactionReference: true,
      click: {
        select: {
          id: true,
          clickId: true,
          clickedAt: true,
          ipAddress: true,
          userAgent: true,
          referrer: true,
          trackingTokens: true,
          trafficSource: { select: { id: true, name: true, type: true } },
          campaign: { select: { id: true, name: true, slug: true, offer: { select: { id: true, name: true } } } },
        },
      },
      outboundPostbacks: { select: { id: true, status: true, attemptCount: true, lastError: true, lastResponseStatus: true, lastResponseSummary: true, updatedAt: true } },
    },
  });

  return conversions.map((conversion) => ({
    ...conversion,
    valueMinor: conversion.valueMinor.toString(),
    trackingTokens: jsonRecord(conversion.click.trackingTokens),
  }));
}
