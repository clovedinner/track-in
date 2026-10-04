import Link from "next/link";
import type { Metadata } from "next";

import { getCampaignList, parseCampaignListFilters, type CampaignListRow } from "@/lib/admin/campaign-views";
import AdminNavigation from "@/app/admin/admin-navigation";

export const metadata: Metadata = { title: "Campaigns | Track.in", description: "Private campaign performance." };
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function formatMinor(value: number, currency: string) {
  return `${value.toLocaleString()} ${currency}`;
}

function statusClass(status: string) {
  return status === "active" ? "bg-[#dcebdc] text-[#285b38]" : status === "paused" ? "bg-[#ebe7dc] text-[#6c5a2f]" : "bg-[#e8e3e0] text-[#68605c]";
}

function queryFor(params: URLSearchParams, changes: Record<string, string | undefined>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return `/admin/campaigns?${next.toString()}`;
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") params.set(key, value);
  const filters = parseCampaignListFilters(params);

  let rows: CampaignListRow[] | null = null;
  try { rows = await getCampaignList(filters); } catch { rows = null; }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]">
      <AdminNavigation pathname="/admin/campaigns" />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex flex-col gap-5 border-b border-[#c8c3b8] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f2d] hover:underline">Track.in / private</Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Campaigns</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#59636c]">Performance by campaign, derived from persisted clicks and conversions.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin/campaigns/new" className="bg-[#17202a] px-4 py-2.5 text-white hover:bg-[#a34f2d]">New campaign +</Link>
            <Link href="/admin" className="py-2.5 text-[#a34f2d] hover:underline">Back to verification →</Link>
          </div>
        </header>

        <form className="mt-8 grid gap-3 border border-[#c8c3b8] bg-[#faf8f3] p-4 sm:grid-cols-[minmax(0,1fr)_160px_160px_auto] sm:items-end" method="get">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]">Search
            <input id="campaign-search" name="q" defaultValue={filters.search ?? ""} placeholder="Name or slug" className="mt-2 block w-full border border-[#c8c3b8] bg-white px-3 py-2 text-sm outline-none focus:border-[#a34f2d] focus:ring-2 focus:ring-[#a34f2d]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]">Status
            <select id="campaign-status" name="status" defaultValue={filters.status ?? ""} className="mt-2 block w-full border border-[#c8c3b8] bg-white px-3 py-2 text-sm outline-none focus:border-[#a34f2d] focus:ring-2 focus:ring-[#a34f2d]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">
              <option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]">Sort by
            <select id="campaign-sort" name="sort" defaultValue={filters.sort ?? "createdAt"} className="mt-2 block w-full border border-[#c8c3b8] bg-white px-3 py-2 text-sm outline-none focus:border-[#a34f2d] focus:ring-2 focus:ring-[#a34f2d]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">
              <option value="createdAt">Newest</option><option value="name">Name</option><option value="clicks">Clicks</option><option value="conversions">Conversions</option>
            </select>
          </label>
          <button type="submit" className="border border-[#17202a] bg-[#17202a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a34f2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">Apply</button>
        </form>

        {rows === null ? <ErrorPanel /> : rows.length === 0 ? <EmptyPanel /> : (
          <section className="mt-8 overflow-x-auto border border-[#c8c3b8] bg-[#faf8f3]" aria-label="Campaign performance">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#e8e3d9] text-xs uppercase tracking-[0.1em] text-[#59636c]"><tr>
                {[["Campaign", "name"], ["Status", undefined], ["Clicks", "clicks"], ["Conversions", "conversions"], ["Revenue", undefined], ["Created", "createdAt"]].map(([label, sort]) => <th key={label} className="px-4 py-3 font-semibold">{sort ? <Link href={queryFor(params, { sort, direction: filters.sort === sort && filters.direction === "desc" ? "asc" : "desc" })} className="hover:text-[#a34f2d]">{label} ↕</Link> : label}</th>)}
              </tr></thead>
              <tbody>{rows.map((row) => <CampaignRow key={row.id} row={row} />)}</tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

function CampaignRow({ row }: { row: CampaignListRow }) {
  return <tr className="border-t border-[#ded9cf] align-top hover:bg-[#f2eee5]">
    <td className="px-4 py-4"><Link href={`/admin/campaigns/${row.id}`} className="font-semibold text-[#17202a] hover:text-[#a34f2d] hover:underline">{row.name}</Link><p className="mt-1 font-mono text-xs text-[#59636c]">{row.slug}</p><p className="mt-1 text-xs text-[#59636c]">{row.trafficSourceName ?? "No traffic source"}</p></td>
    <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
    <td className="px-4 py-4 font-mono">{row.clicks.toLocaleString()}</td>
    <td className="px-4 py-4 font-mono">{row.conversions.toLocaleString()}</td>
    <td className="px-4 py-4 font-mono">{formatMinor(row.revenueMinor, row.defaultCurrency)}</td>
    <td className="whitespace-nowrap px-4 py-4 text-xs text-[#59636c]">{dateFormatter.format(row.createdAt)} UTC</td>
  </tr>;
}

function EmptyPanel() { return <section className="mt-8 border border-dashed border-[#a9a398] bg-[#faf8f3] px-6 py-10"><h2 className="text-lg font-semibold">No campaigns match these filters.</h2><p className="mt-2 text-sm text-[#59636c]">Create a campaign or clear the search and status filters.</p></section>; }
function ErrorPanel() { return <section className="mt-8 border border-[#a34f2d] bg-[#fffaf5] px-6 py-8"><h2 className="text-lg font-semibold">Campaigns unavailable.</h2><p className="mt-2 text-sm text-[#59636c]">The database snapshot could not be loaded. Check the connection and try again.</p></section>; }
