import type { Metadata } from "next";

import { prisma } from "@/lib/database/prisma";
import { getOverviewMetrics, type DashboardFilters } from "@/lib/metrics/queries";
import AdminNavigation from "@/app/admin/admin-navigation";

export const metadata: Metadata = {
  title: "Overview | Track.in",
  description: "Private campaign performance overview.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function buildFilters(params: SearchParams): DashboardFilters {
  const fromValue = first(params.from);
  const toValue = first(params.to);
  return {
    from: parseDate(fromValue),
    to: parseDate(toValue, true),
    campaignId: first(params.campaign),
    trafficSourceId: first(params.source),
    eventType: first(params.event),
  };
}

function formatInteger(value: number) {
  return value.toLocaleString("en-US");
}

function formatRate(value: number | null) {
  return value === null ? "Unavailable" : `${(value * 100).toFixed(2)}%`;
}

function formatMinor(value: number | null) {
  return value === null ? "Unavailable" : `${formatInteger(value)} minor units`;
}

function filterValue(value: string | string[] | undefined) {
  return first(value) ?? "";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const filters = buildFilters(params);

  const [metrics, campaigns, trafficSources, eventRows] = await Promise.all([
    getOverviewMetrics(filters),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.trafficSource.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.conversion.findMany({ distinct: ["eventType"], orderBy: { eventType: "asc" }, select: { eventType: true } }),
  ]);

  const hasData = metrics.clicks > 0 || metrics.conversions > 0;
  const hasFilters = Boolean(first(params.from) || first(params.to) || first(params.campaign) || first(params.source) || first(params.event));

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]">
      <AdminNavigation pathname="/admin/dashboard" />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex flex-col gap-6 border-b border-[#c8c3b8] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f2d] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f2d]" href="/admin">Track.in / private</a>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Performance overview.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#59636c]">The numbers that answer whether tracked traffic is converting and whether outbound delivery is healthy.</p>
          </div>
          <div className="text-left text-xs text-[#59636c] sm:text-right">
            <p className="font-semibold uppercase tracking-[0.16em] text-[#17202a]">UTC</p>
            <p className="mt-1">Live database metrics</p>
          </div>
        </header>

        <section className="mt-8 border border-[#c8c3b8] bg-[#faf8f3] p-5 sm:p-6" aria-labelledby="filters-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 id="filters-heading" className="text-sm font-semibold uppercase tracking-[0.14em]">Filter the snapshot</h2>
              <p className="mt-1 text-xs text-[#59636c]">All dates use UTC. Leave blank for all available records.</p>
            </div>
            {hasFilters ? <a className="text-sm font-medium text-[#a34f2d] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f2d]" href="/admin/dashboard">Clear filters</a> : null}
          </div>
          <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <label className="text-xs font-semibold text-[#59636c]">From<input className="mt-2 block w-full border border-[#bdb8ad] bg-white px-3 py-2.5 text-sm font-normal text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" type="date" name="from" defaultValue={filterValue(params.from)} /></label>
            <label className="text-xs font-semibold text-[#59636c]">To<input className="mt-2 block w-full border border-[#bdb8ad] bg-white px-3 py-2.5 text-sm font-normal text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" type="date" name="to" defaultValue={filterValue(params.to)} /></label>
            <label className="text-xs font-semibold text-[#59636c]">Campaign<select className="mt-2 block w-full border border-[#bdb8ad] bg-white px-3 py-2.5 text-sm font-normal text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" name="campaign" defaultValue={filterValue(params.campaign)}><option value="">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#59636c]">Traffic source<select className="mt-2 block w-full border border-[#bdb8ad] bg-white px-3 py-2.5 text-sm font-normal text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" name="source" defaultValue={filterValue(params.source)}><option value="">All sources</option>{trafficSources.map((source) => <option key={source.id} value={source.id}>{source.name} ({source.type})</option>)}</select></label>
            <label className="text-xs font-semibold text-[#59636c]">Event type<select className="mt-2 block w-full border border-[#bdb8ad] bg-white px-3 py-2.5 text-sm font-normal text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" name="event" defaultValue={filterValue(params.event)}><option value="">All events</option>{eventRows.map((row) => <option key={row.eventType} value={row.eventType}>{row.eventType}</option>)}</select></label>
            <div className="sm:col-span-2 lg:col-span-5"><button className="border border-[#17202a] bg-[#17202a] px-5 py-2.5 text-sm font-semibold text-[#faf8f3] hover:bg-[#38434b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" type="submit">Apply filters</button></div>
          </form>
        </section>

        <section className="mt-8 grid gap-px border-x border-b border-[#c8c3b8] bg-[#c8c3b8] sm:grid-cols-2 xl:grid-cols-4" aria-label="Overview metrics">
          <Metric label="Clicks" value={formatInteger(metrics.clicks)} />
          <Metric label="Conversions" value={formatInteger(metrics.conversions)} />
          <Metric label="Conversion rate" value={formatRate(metrics.conversionRate)} />
          <Metric label="Revenue" value={formatMinor(metrics.revenueMinor)} />
          <Metric label="Profit" value={formatMinor(metrics.profitMinor)} note="Requires imported cost" />
          <Metric label="ROI" value={metrics.roi === null ? "Unavailable" : `${(metrics.roi * 100).toFixed(2)}%`} note="Requires non-zero cost" />
          <Metric label="Pending / processing" value={formatInteger(metrics.pendingDeliveries)} tone={metrics.pendingDeliveries > 0 ? "alert" : "normal"} />
          <Metric label="Retrying / failed" value={`${formatInteger(metrics.retryingDeliveries)} / ${formatInteger(metrics.permanentlyFailedDeliveries)}`} tone={metrics.permanentlyFailedDeliveries > 0 ? "alert" : "normal"} />
        </section>

        {!hasData ? (
          <section className="mt-10 border border-dashed border-[#a9a398] bg-[#faf8f3] px-6 py-10" role="status">
            <h2 className="text-lg font-semibold">{hasFilters ? "No records match these filters." : "No tracking activity yet."}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#59636c]">{hasFilters ? "Try a wider date range or clear one of the filters." : "Send a test click through an active campaign, then complete a controlled conversion. The metrics will appear here from the persisted records."}</p>
          </section>
        ) : (
          <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-label="Delivery summary">
            <Summary title="Outbound delivery" description="Durable postback work created from accepted conversions." items={[["Pending or processing", metrics.pendingDeliveries], ["Retrying", metrics.retryingDeliveries], ["Permanently failed", metrics.permanentlyFailedDeliveries]]} />
            <section className="border border-[#c8c3b8] bg-[#faf8f3] p-6"><h2 className="text-xl font-semibold tracking-[-0.02em]">Metric notes</h2><p className="mt-3 text-sm leading-6 text-[#59636c]">Revenue is displayed in persisted minor units because the current overview can contain multiple currencies. Cost, profit, and ROI remain unavailable until cost imports are added.</p></section>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, note, tone = "normal" }: { label: string; value: string; note?: string; tone?: "normal" | "alert" }) {
  return <div className="bg-[#faf8f3] px-5 py-5 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#59636c]">{label}</p><p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl ${tone === "alert" ? "text-[#a34f2d]" : "text-[#17202a]"}`}>{value}</p>{note ? <p className="mt-2 text-xs text-[#59636c]">{note}</p> : null}</div>;
}

function Summary({ title, description, items }: { title: string; description: string; items: [string, number][] }) {
  return <section className="border border-[#c8c3b8] bg-[#faf8f3] p-6"><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-1 text-sm text-[#59636c]">{description}</p><dl className="mt-5 grid gap-3 sm:grid-cols-3">{items.map(([label, value]) => <div key={label} className="border-t border-[#ded9cf] pt-3"><dt className="text-xs text-[#59636c]">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value.toLocaleString("en-US")}</dd></div>)}</dl></section>;
}
