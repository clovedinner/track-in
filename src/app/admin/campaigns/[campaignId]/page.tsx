import Link from "next/link";
import type { Metadata } from "next";

import { campaignDetailFilters, getCampaignDetail } from "@/lib/admin/campaign-views";
import AdminNavigation from "@/app/admin/admin-navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import StatusControl from "./status-control";
import SetupModalTrigger from "./setup-modal-trigger";
import CampaignSetupContent from "./setup/setup-content";
import { prisma } from "@/lib/database/prisma";
import VisitsTable from "./visits-table";

export const metadata: Metadata = { title: "Campaign detail | Trakio", description: "Private campaign detail." };
export const dynamic = "force-dynamic";


function shortId(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function statusClass(status: string) { return status === "active" || status === "delivered" ? "bg-[#F0C020] text-[#121212]" : status.includes("failed") ? "bg-[#F0F0F0] text-[#D02020]" : "bg-[#E0E0E0] text-[#121212]"; }

export default async function CampaignDetailPage({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ campaignId }, input] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") query.set(key, value);
  const user = await requireCurrentUser();
  const requestedVisitsPage = Number(query.get("page"));
  const visitsPage = Number.isSafeInteger(requestedVisitsPage) && requestedVisitsPage > 0 ? requestedVisitsPage : 1;
  let detail = null;
  try { detail = await getCampaignDetail(campaignId, { ...campaignDetailFilters(query, user.timezone), ownerId: user.id }, { visitsPage }); } catch { detail = null; }

  if (!detail) return <main className="min-h-screen bg-[#F0F0F0] px-5 py-8 text-[#121212] sm:px-8 lg:px-12 lg:py-12"><div className="mx-auto max-w-2xl border-2 border-[#D02020] bg-[#FFFFFF] px-6 py-8"><Link href="/admin/campaigns" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D02020] hover:underline">← Campaigns</Link><h1 className="mt-5 text-2xl font-semibold">Campaign detail unavailable.</h1><p className="mt-3 text-sm leading-6 text-[#121212]">This campaign may not exist, or its data could not be loaded. Try again or return to the campaign list.</p></div></main>;
  const setupCampaign = await prisma.campaign.findUnique({ where: { id: campaignId, ownerId: user.id }, select: { id: true, slug: true, name: true, status: true, trackingMode: true, destinationUrl: true, offerId: true, defaultCurrency: true, allowedTrackingParameters: true, trafficSource: { select: { type: true, enabled: true, configuration: true } } } });
  if (!setupCampaign) return null;
  const visitRangeStart = detail.visitPagination.total === 0 ? 0 : (detail.visitPagination.page - 1) * detail.visitPagination.pageSize + 1;
  const visitRangeEnd = Math.min(detail.visitPagination.page * detail.visitPagination.pageSize, detail.visitPagination.total);
  function visitsPageHref(page: number) {
    const nextQuery = new URLSearchParams(query);
    if (page <= 1) nextQuery.delete("page");
    else nextQuery.set("page", String(page));
    const search = nextQuery.toString();
    return `/admin/campaigns/${encodeURIComponent(campaignId)}${search ? `?${search}` : ""}`;
  }

  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/campaigns" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin/campaigns" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D02020] hover:underline">← Campaigns</Link><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{detail.campaign.name}</h1><p className="mt-2 font-mono text-sm text-[#121212]">{detail.campaign.slug}</p></div><div className="flex flex-col items-start gap-3 text-left sm:items-end sm:text-right"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusClass(detail.campaign.status)}`}>{detail.campaign.status}</span><p className="text-sm">{detail.campaign.trafficSourceName ?? "No traffic source"}</p><StatusControl campaignId={detail.campaign.id} status={detail.campaign.status} /><SetupModalTrigger><CampaignSetupContent campaign={setupCampaign} /></SetupModalTrigger></div></header>
    <section className="mt-8 grid gap-px border-x-2 border-b-2 border-[#121212] bg-[#121212] sm:grid-cols-3" aria-label="Campaign metrics"><Metric label="Visits" value={detail.metrics.clicks.toLocaleString()} /><Metric label="Conversions" value={detail.metrics.conversions.toLocaleString()} /><Metric label="Rate" value={detail.metrics.conversionRate === null ? "—" : `${(detail.metrics.conversionRate * 100).toFixed(2)}%`} /></section>
    <form method="get" className="mt-8 flex flex-col gap-3 border-2 border-[#121212] bg-[#FFFFFF] p-4 sm:flex-row sm:items-end"><label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">From<input type="date" name="from" defaultValue={query.get("from") ?? ""} className="mt-2 block border-2 border-[#121212] bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">To<input type="date" name="to" defaultValue={query.get("to") ?? ""} className="mt-2 block border-2 border-[#121212] bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#121212]">Event<input name="eventType" defaultValue={query.get("eventType") ?? ""} placeholder="purchase" className="mt-2 block border-2 border-[#121212] bg-white px-3 py-2 text-sm" /></label><button type="submit" className="border-2 border-[#121212] bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D02020]">Apply range</button></form>
    <div className="mt-10 grid gap-10">
      <section className="min-w-0" aria-labelledby="recent-visits-title">
        <h2 id="recent-visits-title" className="text-xl font-semibold">Recent visits</h2>
        <VisitsTable visits={detail.recentClicks.map((click) => ({
          clickId: click.clickId,
          clickedAt: click.clickedAt,
          trackingTokens: click.trackingTokens,
          capturedLabel: `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(click.clickedAt)} ${user.timezone}`,
        }))} />
        <div className="mt-3 flex flex-col gap-3 border-2 border-[#121212] bg-[#FFFFFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#333333]">Showing {visitRangeStart}–{visitRangeEnd} of {detail.visitPagination.total.toLocaleString()} visits</p>
          <nav className="flex items-center gap-2" aria-label="Visit pages">
            {detail.visitPagination.page > 1 ? <Link rel="prev" href={visitsPageHref(detail.visitPagination.page - 1)} className="border-2 border-[#121212] px-3 py-2 text-xs font-semibold hover:bg-[#F0F0F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1744C8]">Previous</Link> : <span aria-disabled="true" className="border-2 border-[#D0D0D0] px-3 py-2 text-xs font-semibold text-[#666666]">Previous</span>}
            <span className="px-2 text-xs" aria-live="polite">Page {detail.visitPagination.page} of {detail.visitPagination.pageCount}</span>
            {detail.visitPagination.page < detail.visitPagination.pageCount ? <Link rel="next" href={visitsPageHref(detail.visitPagination.page + 1)} className="border-2 border-[#121212] px-3 py-2 text-xs font-semibold hover:bg-[#F0F0F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1744C8]">Next</Link> : <span aria-disabled="true" className="border-2 border-[#D0D0D0] px-3 py-2 text-xs font-semibold text-[#666666]">Next</span>}
          </nav>
        </div>
      </section>
      <ActivityTable title="Recent conversions" headers={["Event", "Occurred"]}>{detail.recentConversions.map((conversion) => <tr key={conversion.id} className="border-t-2 border-[#121212]"><td className="px-4 py-3"><span className="font-medium">{conversion.eventType}</span><span className="mt-1 block font-mono text-[11px] text-[#121212]">{shortId(conversion.eventId)}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs text-[#121212]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(conversion.occurredAt)} {user.timezone}</td></tr>)}</ActivityTable>
    </div>
  </div></main>;
}

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "alert" }) { return <div className="bg-[#FFFFFF] px-5 py-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#121212]">{label}</p><p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${tone === "alert" ? "text-[#D02020]" : "text-[#121212]"}`}>{value}</p></div>; }
function ActivityTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) { return <section className="min-w-0"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]"><table className="w-full min-w-[520px] border-collapse text-left text-sm"><thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em] text-[#121212]"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>; }
