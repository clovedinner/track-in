import Link from "next/link";
import type { Metadata } from "next";

import { getCampaignList, parseCampaignListFilters, type CampaignListRow } from "@/lib/admin/campaign-views";
import AdminNavigation from "@/app/admin/admin-navigation";

export const metadata: Metadata = { title: "Campaigns | Track.in", description: "Private campaign performance." };
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function statusClass(status: string) {
  return status === "active" ? "bg-[#F0C020] text-[#121212]" : status === "paused" ? "bg-[#E0E0E0] text-[#121212]" : "bg-[#E0E0E0] text-[#121212]";
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
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/campaigns" />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D02020] hover:underline">Track.in / private</Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Campaigns</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#121212]">Performance by campaign, derived from persisted clicks and conversions.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin/campaigns/new" className="bg-[#121212] px-4 py-2.5 text-white hover:bg-[#D02020]">New campaign +</Link>
            <Link href="/admin" className="py-2.5 text-[#D02020] hover:underline">Back to verification →</Link>
          </div>
        </header>

        <form className="mt-8 grid gap-3 border-2 border-[#121212] bg-[#FFFFFF] p-4 sm:grid-cols-[minmax(0,1fr)_160px_160px_auto] sm:items-end" method="get">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">Search
            <input id="campaign-search" name="q" defaultValue={filters.search ?? ""} placeholder="Name or slug" className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">Status
            <select id="campaign-status" name="status" defaultValue={filters.status ?? ""} className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">
              <option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">Sort by
            <select id="campaign-sort" name="sort" defaultValue={filters.sort ?? "createdAt"} className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm outline-none focus:border-[#D02020] focus:ring-2 focus:ring-[#D02020]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">
              <option value="createdAt">Newest</option><option value="name">Name</option><option value="clicks">Clicks</option><option value="conversions">Conversions</option>
            </select>
          </label>
          <button type="submit" className="border-2 border-[#121212] bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Apply</button>
        </form>

        {rows === null ? <ErrorPanel /> : rows.length === 0 ? <EmptyPanel /> : (
          <section className="mt-8 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]" aria-label="Campaign performance">
            <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
              <thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em] text-[#121212]"><tr>
                {[["Campaign", "name"], ["Status", undefined], ["Visits", "clicks"], ["Conversions", "conversions"], ["Error", undefined], ["Registration / FTD", undefined], ["Created", "createdAt"]].map(([label, sort]) => <th key={label} className="px-4 py-3 font-semibold">{sort ? <Link href={queryFor(params, { sort, direction: filters.sort === sort && filters.direction === "desc" ? "asc" : "desc" })} className="hover:text-[#D02020]">{label} ↕</Link> : label}</th>)}
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
  return <tr className="border-t-2 border-[#121212] align-top hover:bg-[#E0E0E0]">
    <td className="px-4 py-4"><Link href={`/admin/campaigns/${row.id}`} className="font-semibold text-[#121212] hover:text-[#D02020] hover:underline">{row.name}</Link><p className="mt-1 font-mono text-xs text-[#121212]">{row.slug}</p><p className="mt-1 text-xs text-[#121212]">{row.trafficSourceName ?? "No traffic source"}</p></td>
    <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
    <td className="px-4 py-4 font-mono">{row.clicks.toLocaleString()}</td>
    <td className="px-4 py-4 font-mono">{row.conversions.toLocaleString()}</td>
    <td className="px-4 py-4 font-mono text-[#121212]" title="Unknown-click conversion errors are not persisted yet">—</td>
    <td className="px-4 py-4 font-mono">{row.registrations.toLocaleString()} / {row.ftds.toLocaleString()}</td>
    <td className="whitespace-nowrap px-4 py-4 text-xs text-[#121212]">{dateFormatter.format(row.createdAt)} UTC</td>
  </tr>;
}

function EmptyPanel() { return <section className="mt-8 border-2 border-dashed border-[#121212] bg-[#FFFFFF] px-6 py-10"><h2 className="text-lg font-semibold">No campaigns match these filters.</h2><p className="mt-2 text-sm text-[#121212]">Create a campaign or clear the search and status filters.</p></section>; }
function ErrorPanel() { return <section className="mt-8 border-2 border-[#D02020] bg-[#FFFFFF] px-6 py-8"><h2 className="text-lg font-semibold">Campaigns unavailable.</h2><p className="mt-2 text-sm text-[#121212]">The database snapshot could not be loaded. Check the connection and try again.</p></section>; }
