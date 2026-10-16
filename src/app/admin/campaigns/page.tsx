import Link from "next/link";
import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import CampaignsTable from "@/app/admin/campaigns/campaigns-table";
import { getCampaignList, parseCampaignListFilters, type CampaignListRow } from "@/lib/admin/campaign-views";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";
import type { CustomConversionColumn } from "@/lib/admin/custom-conversion-metrics";

export const metadata: Metadata = { title: "Campaigns | Trakio", description: "Private campaign performance." };
export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const user = await requireCurrentUser();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") params.set(key, value);
  const filters = { ...parseCampaignListFilters(params), ownerId: user.id };
  let rows: CampaignListRow[] | null = null;
  let customConversions: CustomConversionColumn[] = [];
  try {
    [rows, customConversions] = await Promise.all([
      getCampaignList(filters),
      prisma.customConversion.findMany({ where: { ownerId: user.id, includeInConversions: true }, select: { id: true, name: true, eventValues: true, includeInConversions: true } }),
    ]);
  } catch { rows = null; }

  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/campaigns" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D02020] hover:underline">Trakio / private</Link><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Campaigns</h1><p className="mt-3 max-w-xl text-sm leading-6">See every campaign’s routing, status, and persisted performance in one place.</p></div><div className="flex flex-wrap gap-4 text-sm font-semibold"><Link href="/admin/campaigns/new" className="bg-[#121212] px-4 py-2.5 text-white hover:bg-[#D02020]">New campaign +</Link><Link href="/admin" className="py-2.5 text-[#D02020] hover:underline">Back to dashboard →</Link></div></header>
    <form className="mt-8 grid gap-3 border-2 border-[#121212] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_160px_160px_auto] sm:items-end" method="get"><label className="text-xs font-semibold uppercase tracking-[0.12em]">Search<input id="campaign-search" name="q" defaultValue={filters.search ?? ""} placeholder="Name or slug" className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20" /></label><label className="text-xs font-semibold uppercase tracking-[0.12em]">Status<select id="campaign-status" name="status" defaultValue={filters.status ?? ""} className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20"><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label><label className="text-xs font-semibold uppercase tracking-[0.12em]">Sort by<select id="campaign-sort" name="sort" defaultValue={filters.sort ?? "createdAt"} className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20"><option value="createdAt">Newest</option><option value="name">Name</option><option value="clicks">Clicks</option><option value="conversions">Conversions</option></select></label><button type="submit" className="border-2 border-[#121212] bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D02020]">Apply</button></form>
    {rows === null ? <section className="mt-8 border-2 border-[#D02020] bg-white px-6 py-8"><h2 className="text-lg font-semibold">Campaigns unavailable.</h2><p className="mt-2 text-sm">The database snapshot could not be loaded. Check the connection and try again.</p></section> : <CampaignsTable rows={rows} timezone={user.timezone} customConversions={customConversions} />}
  </div></main>;
}
