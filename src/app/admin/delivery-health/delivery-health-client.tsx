"use client";

import { useCallback, useEffect, useState } from "react";

import AdminNavigation from "@/app/admin/admin-navigation";

type Status = "pending" | "processing" | "retryable_failed" | "delivered" | "permanently_failed";
type Filter = Status | "all";

type Postback = {
  id: string;
  destination_host: string | null;
  status: Status;
  attempt_count: number;
  next_attempt_at: string | null;
  last_response_status: number | null;
  last_response_summary: string | null;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  conversion: {
    event_id: string;
    event_type: string;
    value_minor: string;
    currency: string;
    click_id: string;
    campaign: { slug: string; name: string };
  };
  traffic_source: { id: string; name: string; type: string };
};

type HealthResponse = {
  status: Filter;
  counts: Record<Status, number>;
  postbacks: Postback[];
};

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All deliveries" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "retryable_failed", label: "Retrying / failed" },
  { value: "permanently_failed", label: "Permanent failures" },
  { value: "delivered", label: "Delivered" },
];

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function formatDate(value: string | null) {
  return value ? `${dateFormatter.format(new Date(value))} UTC` : "—";
}

function statusLabel(status: Status) {
  return status.replaceAll("_", " ");
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function statusClass(status: Status) {
  if (status === "delivered") return "border-[#121212] bg-[#F0C020] text-[#121212]";
  if (status === "permanently_failed") return "border-[#D02020] bg-[#F0F0F0] text-[#8b3d23]";
  if (status === "retryable_failed") return "border-[#F0C020] bg-[#F0C020] text-[#121212]";
  return "border-[#121212] bg-[#F0F0F0] text-[#121212]";
}

export default function DeliveryHealthClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async (selected: Filter, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const query = selected === "all" ? "" : `?status=${encodeURIComponent(selected)}`;
      const response = await fetch(`/api/admin/delivery-health${query}`, { signal, cache: "no-store" });
      const body = await response.json() as HealthResponse | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in body && body.error?.message ? body.error.message : "Unable to load delivery health.");
      setData(body as HealthResponse);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Unable to load delivery health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // The effect synchronizes this screen with the protected API on mount and filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(filter, controller.signal);
    return () => controller.abort();
  }, [filter, load]);

  async function retry(id: string) {
    setRetrying(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/delivery-health/${id}/retry`, { method: "POST" });
      const body = await response.json() as { error?: { message?: string }; status?: string };
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to queue retry.");
      setNotice("Delivery queued for retry.");
      await load(filter);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to queue retry.");
    } finally {
      setRetrying(null);
    }
  }

  const counts = data?.counts;
  const totalAttention = (counts?.pending ?? 0) + (counts?.processing ?? 0) + (counts?.retryable_failed ?? 0) + (counts?.permanently_failed ?? 0);

  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/delivery-health" />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020]">Track.in / private</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Delivery health.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#121212]">See what reached an ad platform, what is waiting, and which deliveries need an operator retry.</p>
          </div>
          <a className="text-sm font-semibold text-[#D02020] underline underline-offset-4" href="/admin/verification">Back to verification</a>
        </header>

        <section aria-label="Delivery totals" className="mt-8 grid gap-px border-x-2 border-b-2 border-[#121212] bg-[#121212] sm:grid-cols-4">
          <Metric label="Pending" value={counts?.pending ?? "—"} />
          <Metric label="Retryable failures" value={counts?.retryable_failed ?? "—"} tone={counts && counts.retryable_failed > 0 ? "alert" : "normal"} />
          <Metric label="Permanent failures" value={counts?.permanently_failed ?? "—"} tone={counts && counts.permanently_failed > 0 ? "alert" : "normal"} />
          <Metric label="Needs attention" value={data ? totalAttention : "—"} tone={totalAttention > 0 ? "alert" : "normal"} />
        </section>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#121212]" htmlFor="delivery-filter">Show</label>
            <select id="delivery-filter" className="mt-2 block min-w-56 border-2 border-[#121212] bg-[#FFFFFF] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
              {filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <button type="button" className="self-start border-2 border-[#121212] bg-[#121212] px-4 py-2 text-sm font-semibold text-[#FFFFFF] hover:bg-[#34404b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020] disabled:cursor-wait disabled:opacity-60 sm:self-auto" onClick={() => void load(filter)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div aria-live="polite" className="mt-4 min-h-6 text-sm">
          {notice && <p className="text-[#121212]">{notice}</p>}
          {error && <p className="text-[#8b3d23]" role="alert">{error}</p>}
        </div>

        <section className="mt-2 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]" aria-label="Outbound postbacks">
          {loading && !data ? <p className="px-5 py-10 text-sm text-[#121212]">Loading delivery records…</p> : data?.postbacks.length === 0 ? <p className="px-5 py-10 text-sm text-[#121212]">No deliveries match this filter.</p> : (
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em] text-[#121212]"><tr>{["Status", "Conversion", "Campaign", "Provider", "Attempts", "Last diagnostic", "Action"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>
                {data?.postbacks.map((postback) => {
                  const canRetry = postback.status === "retryable_failed" || postback.status === "permanently_failed";
                  return <tr key={postback.id} className="border-t-2 border-[#121212] align-top">
                    <td className="px-4 py-4"><span className={`inline-flex border-2 px-2 py-1 text-xs font-semibold capitalize ${statusClass(postback.status)}`}>{statusLabel(postback.status)}</span><p className="mt-2 whitespace-nowrap text-xs text-[#121212]">Updated {formatDate(postback.updated_at)}</p></td>
                    <td className="px-4 py-4"><p className="font-medium">{postback.conversion.event_type}</p><p className="mt-1 font-mono text-[11px] text-[#121212]" title={postback.conversion.event_id}>{shortId(postback.conversion.event_id)}</p><p className="mt-1 text-xs text-[#121212]">{postback.conversion.value_minor} {postback.conversion.currency}</p></td>
                    <td className="px-4 py-4"><p className="font-medium">{postback.conversion.campaign.name}</p><p className="mt-1 text-xs text-[#121212]">{postback.conversion.campaign.slug}</p></td>
                    <td className="px-4 py-4"><p className="font-medium">{postback.traffic_source.name}</p><p className="mt-1 text-xs text-[#121212]">{postback.destination_host ?? postback.traffic_source.type}</p></td>
                    <td className="px-4 py-4 text-center">{postback.attempt_count}</td>
                    <td className="max-w-xs px-4 py-4 text-xs leading-5 text-[#121212]">{postback.last_error ?? postback.last_response_summary ?? (postback.last_response_status ? `HTTP ${postback.last_response_status}` : "No diagnostic recorded.")}<p className="mt-1">Next: {formatDate(postback.next_attempt_at)}</p></td>
                    <td className="px-4 py-4">{canRetry ? <button type="button" className="border-2 border-[#D02020] px-3 py-2 text-xs font-semibold text-[#8b3d23] hover:bg-[#F0F0F0] disabled:cursor-wait disabled:opacity-50" onClick={() => void retry(postback.id)} disabled={retrying === postback.id}>{retrying === postback.id ? "Queueing…" : "Retry"}</button> : <span className="text-xs text-[#121212]">No action</span>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number | string; tone?: "normal" | "alert" }) {
  return <div className="bg-[#FFFFFF] px-5 py-5 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#121212]">{label}</p><p className={`mt-3 text-3xl font-semibold tracking-[-0.04em] ${tone === "alert" ? "text-[#D02020]" : "text-[#121212]"}`}>{typeof value === "number" ? value.toLocaleString() : value}</p></div>;
}
