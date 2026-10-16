import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import { prisma } from "@/lib/database/prisma";
import { getConversionWorkspace, type ConversionFilters } from "@/lib/admin/conversions";
import ConversionsClient from "./conversions-client";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { parseDateInTimezone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Conversions | Trakio", description: "Inspect conversion events and captured attribution data." };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export default async function ConversionsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const user = await requireCurrentUser();
  const filters: ConversionFilters = {
    ownerId: user.id,
    from: parseDateInTimezone(first(params.from), user.timezone),
    to: parseDateInTimezone(first(params.to), user.timezone, true),
    campaignId: first(params.campaign),
    trafficSourceId: first(params.source),
    eventType: first(params.event),
    query: first(params.q),
  };
  const [conversions, campaigns, trafficSources, eventTypes] = await Promise.all([
    getConversionWorkspace(filters),
    prisma.campaign.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.trafficSource.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.conversion.findMany({ where: { click: { campaign: { ownerId: user.id } } }, distinct: ["eventType"], orderBy: { eventType: "asc" }, select: { eventType: true } }),
  ]);

  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/conversions" /><div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><header className="border-b-2 border-[#121212] pb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020]">Trakio / private</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Conversions.</h1><p className="mt-3 max-w-2xl text-sm leading-6">Review every accepted event, the click that attributed it, captured traffic-source values, and the delivery result.</p></header><ConversionsClient initialConversions={conversions} campaigns={campaigns} trafficSources={trafficSources} eventTypes={eventTypes.map((row) => row.eventType)} initialFilters={params} timezone={user.timezone} /></div></main>;
}
