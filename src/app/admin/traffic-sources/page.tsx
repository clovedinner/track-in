import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/database/prisma";
import AdminNavigation from "@/app/admin/admin-navigation";
import TrafficSourceCreateModal from "./traffic-source-create-modal";
import TrafficSourcesTable, { type TrafficSourceRow } from "./traffic-sources-table";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCustomConversionCounts, includedCustomConversionColumns, type CustomConversionColumn } from "@/lib/admin/custom-conversion-metrics";

export const metadata: Metadata = { title: "Traffic sources | Trakio", description: "Configure ad-platform traffic sources." };
export const dynamic = "force-dynamic";

export default async function TrafficSourcesPage() {
  const user = await requireCurrentUser();
  const customConversions: CustomConversionColumn[] = await prisma.customConversion.findMany({ where: { ownerId: user.id, includeInConversions: true }, select: { id: true, name: true, eventValues: true, includeInConversions: true } });
  const sources = await prisma.trafficSource.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, enabled: true } });
  const rows = await Promise.all(sources.map(async (source) => {
    const [visits, conversions, conversionEvents] = await Promise.all([
      prisma.click.count({ where: { trafficSourceId: source.id } }),
      prisma.conversion.count({ where: { click: { trafficSourceId: source.id } } }),
      prisma.conversion.findMany({ where: { click: { trafficSourceId: source.id } }, select: { eventType: true } }),
    ]);
    return { ...source, visits, conversions, customConversionCounts: getCustomConversionCounts(conversionEvents, includedCustomConversionColumns(customConversions)) };
  }));
  const tableRows: TrafficSourceRow[] = rows;
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/traffic-sources" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D02020] hover:underline">Trakio / private</Link><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Traffic sources</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#121212]">Connect a traffic source and preserve the tokens needed for attribution.</p></div><TrafficSourceCreateModal /></header>
    <TrafficSourcesTable rows={tableRows} customConversions={includedCustomConversionColumns(customConversions)} />
  </div></main>;
}
