import type { Metadata } from "next";

import { prisma } from "@/lib/database/prisma";
import { getOverviewMetrics, type DashboardFilters } from "@/lib/metrics/queries";
import { getVerificationSnapshot } from "@/lib/admin/verification";
import { logger } from "@/lib/observability/logger";
import AdminNavigation from "@/app/admin/admin-navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { parseDateInTimezone } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Dashboard | Trakio",
  description: "Private campaign and conversion dashboard.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function buildFilters(params: SearchParams, timezone: string): DashboardFilters {
  const fromValue = first(params.from);
  const toValue = first(params.to);
  return {
    from: parseDateInTimezone(fromValue, timezone),
    to: parseDateInTimezone(toValue, timezone, true),
    campaignId: first(params.campaign),
    trafficSourceId: first(params.source),
    eventType: first(params.event),
  };
}

function formatInteger(value: number) {
  return value.toLocaleString("en-US");
}

function filterValue(value: string | string[] | undefined) {
  return first(value) ?? "";
}

async function loadVerificationSnapshot(ownerId: string) {
  try {
    return await getVerificationSnapshot(ownerId);
  } catch (error) {
    logger.error("admin.dashboard_activity_failed", {
      error: error instanceof Error ? error.message : "unknown",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

function formatDate(value: Date, timezone: string) {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value)} ${timezone}`;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function TokenList({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return <span>—</span>;
  const entries = Object.entries(value);
  if (entries.length === 0) return <span>—</span>;
  return <div className="flex max-w-full flex-wrap gap-1.5">{entries.map(([key, token]) => <span key={key} className="inline-flex max-w-full break-all border border-[#121212] bg-[#F0F0F0] px-1.5 py-1 font-mono text-[11px] leading-4"><strong>{key}=</strong>{String(token)}</span>)}</div>;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const user = await requireCurrentUser();
  const filters = buildFilters(params, user.timezone);
  filters.ownerId = user.id;

  const [metrics, campaigns, trafficSources, eventRows, snapshot] = await Promise.all([
    getOverviewMetrics(filters),
    prisma.campaign.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.trafficSource.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.conversion.findMany({ where: { click: { campaign: { ownerId: user.id } } }, distinct: ["eventType"], orderBy: { eventType: "asc" }, select: { eventType: true } }),
    loadVerificationSnapshot(user.id),
  ]);

  const hasData = metrics.clicks > 0 || metrics.conversions > 0;
  const hasFilters = Boolean(first(params.from) || first(params.to) || first(params.campaign) || first(params.source) || first(params.event));

  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/dashboard" />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex flex-col gap-6 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D02020]" href="/admin/dashboard">Trakio / private</a>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Performance overview.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#121212]">See whether tracked traffic is converting, then inspect the latest clicks and conversion records in the same place.</p>
          </div>
          <div className="text-left text-xs text-[#121212] sm:text-right">
            <p className="font-semibold uppercase tracking-[0.16em] text-[#121212]">UTC</p>
            <p className="mt-1">Live database metrics</p>
          </div>
        </header>

        <section className="mt-8 border-2 border-[#121212] bg-[#FFFFFF] p-5 sm:p-6" aria-labelledby="filters-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 id="filters-heading" className="text-sm font-semibold uppercase tracking-[0.14em]">Filter the snapshot</h2>
              <p className="mt-1 text-xs text-[#121212]">All dates use UTC. Leave blank for all available records.</p>
            </div>
            {hasFilters ? <a className="text-sm font-medium text-[#D02020] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D02020]" href="/admin/dashboard">Clear filters</a> : null}
          </div>
          <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <label className="text-xs font-semibold text-[#121212]">From<input className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm font-normal text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" type="date" name="from" defaultValue={filterValue(params.from)} /></label>
            <label className="text-xs font-semibold text-[#121212]">To<input className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm font-normal text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" type="date" name="to" defaultValue={filterValue(params.to)} /></label>
            <label className="text-xs font-semibold text-[#121212]">Campaign<select className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm font-normal text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" name="campaign" defaultValue={filterValue(params.campaign)}><option value="">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#121212]">Traffic source<select className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm font-normal text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" name="source" defaultValue={filterValue(params.source)}><option value="">All sources</option>{trafficSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#121212]">Event type<select className="mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm font-normal text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" name="event" defaultValue={filterValue(params.event)}><option value="">All events</option>{eventRows.map((row) => <option key={row.eventType} value={row.eventType}>{row.eventType}</option>)}</select></label>
            <div className="sm:col-span-2 lg:col-span-5"><button className="border-2 border-[#121212] bg-[#121212] px-5 py-2.5 text-sm font-semibold text-[#FFFFFF] hover:bg-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" type="submit">Apply filters</button></div>
          </form>
        </section>

        <section className="mt-8 grid gap-px border-x-2 border-b-2 border-[#121212] bg-[#121212] sm:grid-cols-3" aria-label="Dashboard metrics">
          <Metric label="Visits" value={formatInteger(metrics.clicks)} />
          <Metric label="Conversions" value={formatInteger(metrics.conversions)} />
          <Metric label="Conversion rate" value={metrics.conversionRate === null ? "Unavailable" : `${(metrics.conversionRate * 100).toFixed(2)}%`} />
        </section>

        {!hasData ? (
          <section className="mt-10 border-2 border-dashed border-[#121212] bg-[#FFFFFF] px-6 py-10" role="status">
            <h2 className="text-lg font-semibold">{hasFilters ? "No records match these filters." : "No tracking activity yet."}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#121212]">{hasFilters ? "Try a wider date range or clear one of the filters." : "Send a test click through an active campaign, then complete a controlled conversion. The metrics will appear here from the persisted records."}</p>
          </section>
        ) : (
          <Activity snapshot={snapshot} timezone={user.timezone} />
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#FFFFFF] px-5 py-5 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#121212]">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{value}</p></div>;
}

function Activity({ snapshot, timezone }: { snapshot: Awaited<ReturnType<typeof getVerificationSnapshot>> | null; timezone: string }) {
  if (!snapshot || (snapshot.recentClicks.length === 0 && snapshot.recentConversions.length === 0)) {
    return <section className="mt-10 border-2 border-dashed border-[#121212] bg-[#FFFFFF] px-6 py-10"><h2 className="text-lg font-semibold">No recent activity to inspect.</h2><p className="mt-2 max-w-xl text-sm leading-6">Send a test visit through an active campaign, then complete a controlled conversion. The latest records will appear here.</p></section>;
  }

  return <div className="mt-10 grid gap-10"><ActivityTable title="Recent visits" description="The tracker records these before redirecting the visitor." headers={["Campaign", "Visit ID", "Captured", "Tokens"]}>{snapshot.recentClicks.map((click) => <tr key={click.clickId} className="border-t-2 border-[#121212] align-top"><td className="px-3 py-4 font-medium">{click.campaign.name}</td><td className="px-3 py-4 font-mono text-xs">{shortId(click.clickId)}</td><td className="whitespace-nowrap px-3 py-4 text-xs">{formatDate(click.clickedAt, timezone)}</td><td className="px-3 py-4 text-xs leading-5"><TokenList value={click.trackingTokens} /></td></tr>)}</ActivityTable><ActivityTable title="Recent conversions" description="Each row ties a conversion event back to the campaign that received it." headers={["Event", "Campaign", "Received"]}>{snapshot.recentConversions.map((conversion) => <tr key={conversion.id} className="border-t-2 border-[#121212] align-top"><td className="px-3 py-4"><p className="font-medium">{conversion.eventType}</p><p className="mt-1 font-mono text-[11px]">{shortId(conversion.eventId)}</p></td><td className="px-3 py-4 text-sm">{conversion.click.campaign.name}</td><td className="whitespace-nowrap px-3 py-4 text-xs">{formatDate(conversion.receivedAt, timezone)}</td></tr>)}</ActivityTable></div>;
}

function ActivityTable({ title, description, headers, children }: { title: string; description: string; headers: string[]; children: React.ReactNode }) {
  return <section className="min-w-0"><div className="mb-4"><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-1 text-sm">{description}</p></div><div className="overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em]"><tr>{headers.map((header) => <th key={header} className="px-3 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}
