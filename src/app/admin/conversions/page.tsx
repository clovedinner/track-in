import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import { prisma } from "@/lib/database/prisma";
import { getConversionWorkspace, type ConversionFilters } from "@/lib/admin/conversions";
import ConversionsClient from "./conversions-client";

export const metadata: Metadata = { title: "Conversions | Trakio", description: "Inspect conversion events and captured attribution data." };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export default async function ConversionsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const filters: ConversionFilters = {
    from: parseDate(first(params.from)),
    to: parseDate(first(params.to), true),
    campaignId: first(params.campaign),
    trafficSourceId: first(params.source),
    eventType: first(params.event),
    query: first(params.q),
  };
  const [conversions, campaigns, trafficSources, eventTypes] = await Promise.all([
    getConversionWorkspace(filters),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.trafficSource.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.conversion.findMany({ distinct: ["eventType"], orderBy: { eventType: "asc" }, select: { eventType: true } }),
  ]);

  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/conversions" /><div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><header className="border-b-2 border-[#121212] pb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020]">Trakio / private</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Conversions.</h1><p className="mt-3 max-w-2xl text-sm leading-6">Review every accepted event, the click that attributed it, captured traffic-source values, and the delivery result.</p></header><ConversionsClient initialConversions={conversions} campaigns={campaigns} trafficSources={trafficSources} eventTypes={eventTypes.map((row) => row.eventType)} initialFilters={params} /></div></main>;
}
