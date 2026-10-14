"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CampaignListRow } from "@/lib/admin/campaign-views";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function statusClass(status: string) {
  return status === "active" ? "bg-[#F0C020] text-[#121212]" : "bg-[#E0E0E0] text-[#121212]";
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "-").slice(0, 90) || `campaign-copy-${Date.now()}`;
}

export default function CampaignsTable({ rows }: { rows: CampaignListRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId((current) => current === id ? null : id);
    setError(null);
  }

  async function duplicate() {
    if (!selected) return;
    setDuplicating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          name: `${selected.name} copy`,
          slug: slugify(`${selected.name} copy`),
          status: "active",
          trackingMode: selected.trackingMode,
          destinationUrl: selected.destinationUrl,
          trafficSourceId: selected.trafficSourceId,
          offerId: selected.offerId,
          defaultCurrency: selected.defaultCurrency,
          allowedTrackingParameters: Array.isArray(selected.allowedTrackingParameters) ? selected.allowedTrackingParameters : [],
        }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to duplicate campaign.");
      setSelectedId(null);
      setDrawer(false);
      router.refresh();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate campaign.");
    } finally {
      setDuplicating(false);
    }
  }

  return <>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-y-2 border-[#121212] bg-white px-4 py-3" aria-label="Campaign actions">
      <p className="text-sm text-[#3e4855]">{selected ? <><strong className="text-[#121212]">Selected:</strong> {selected.name}</> : "Select a campaign to inspect or manage it."}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!selected} onClick={() => { if (selected) { setError(null); setDrawer(true); } }} className="border-2 border-[#121212] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#F0C020] disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
        <button type="button" disabled={!selected || duplicating} onClick={duplicate} className="border-2 border-[#121212] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#F0C020] disabled:cursor-not-allowed disabled:opacity-40">{duplicating ? "Duplicating…" : "Duplicate"}</button>
      </div>
    </div>
    {error ? <div role="alert" className="mt-4 border-2 border-[#D02020] bg-white px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
    <section className="mt-3 overflow-x-auto border-2 border-[#121212] bg-white" aria-label="Campaign performance">
      <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
        <caption className="sr-only">Campaign performance</caption>
        <thead className="bg-[#6F7D99] text-xs uppercase tracking-[0.09em] text-white"><tr>
          <th className="w-12 px-3 py-3"><span className="sr-only">Select</span></th>
          {['Campaign', 'Status', 'Mode', 'Traffic source', 'Visits', 'Conversions', 'Reg / FTD', 'Created'].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className={`border-t border-[#C5CBD5] align-top ${selectedId === row.id ? "bg-[#FFF4C2]" : "odd:bg-white even:bg-[#F4F5F7] hover:bg-[#E7EBF2]"}`}>
          <td className="px-3 py-3"><input type="checkbox" checked={selectedId === row.id} onChange={() => select(row.id)} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-[#1040C0]" /></td>
          <td className="max-w-[320px] px-3 py-3"><Link href={`/admin/campaigns/${row.id}`} className="font-semibold hover:text-[#D02020] hover:underline">{row.name}</Link><p className="mt-1 font-mono text-[11px] text-[#3e4855]">{row.slug}</p></td>
          <td className="px-3 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
          <td className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em]">{row.trackingMode}</td>
          <td className="max-w-[180px] truncate px-3 py-3 text-xs">{row.trafficSourceName ?? "Not connected"}</td>
          <td className="px-3 py-3 font-mono">{row.clicks.toLocaleString()}</td>
          <td className="px-3 py-3 font-mono">{row.conversions.toLocaleString()}</td>
          <td className="px-3 py-3 font-mono">{row.registrations.toLocaleString()} / {row.ftds.toLocaleString()}</td>
          <td className="whitespace-nowrap px-3 py-3 text-xs text-[#3e4855]">{dateFormatter.format(row.createdAt)} UTC</td>
        </tr>)}</tbody>
      </table>
      {rows.length === 0 ? <div className="border-t-2 border-[#121212] px-6 py-10"><h2 className="text-lg font-semibold">No campaigns match these filters.</h2><p className="mt-2 text-sm text-[#121212]">Create a campaign or clear the search and status filters.</p></div> : null}
    </section>
    {drawer && selected ? <section className="fixed inset-0 z-30 bg-[#121212]/35" role="dialog" aria-modal="true" aria-labelledby="campaign-action-title">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Close campaign panel" onClick={() => setDrawer(false)} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto border-l-2 border-[#121212] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b-2 border-[#121212] px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D02020]">Campaign workspace</p><h2 id="campaign-action-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{selected.name}</h2></div><button type="button" onClick={() => setDrawer(false)} aria-label="Close campaign panel" className="text-2xl leading-none text-[#1040C0] hover:text-[#121212]">×</button></header>
        <div className="space-y-6 px-6 py-7">
          <div className="grid grid-cols-2 gap-px border-2 border-[#121212] bg-[#121212]"><div className="bg-[#F0F0F0] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em]">Status</p><p className="mt-1 font-semibold capitalize">{selected.status}</p></div><div className="bg-[#F0F0F0] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em]">Routing</p><p className="mt-1 font-semibold capitalize">{selected.trackingMode}</p></div><div className="bg-[#F0F0F0] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em]">Visits</p><p className="mt-1 font-mono font-semibold">{selected.clicks.toLocaleString()}</p></div><div className="bg-[#F0F0F0] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em]">Conversions</p><p className="mt-1 font-mono font-semibold">{selected.conversions.toLocaleString()}</p></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.12em]">Destination</p><p className="mt-2 break-all border-2 border-[#121212] bg-[#F0F0F0] p-3 font-mono text-xs leading-5">{selected.destinationUrl}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.12em]">Configuration</p><dl className="mt-2 divide-y-2 divide-[#121212] border-2 border-[#121212] text-sm"><div className="flex justify-between gap-4 p-3"><dt>Traffic source</dt><dd className="font-semibold">{selected.trafficSourceName ?? "Not connected"}</dd></div><div className="flex justify-between gap-4 p-3"><dt>Currency</dt><dd className="font-mono font-semibold">{selected.defaultCurrency}</dd></div><div className="flex justify-between gap-4 p-3"><dt>Created</dt><dd>{dateFormatter.format(selected.createdAt)} UTC</dd></div></dl></div>
          <p className="border-2 border-[#121212] bg-[#F0C020] px-4 py-3 text-sm leading-6">Use campaign setup to update tracking instructions, test the click handoff, and finish the destination configuration.</p>
        </div>
        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t-2 border-[#121212] bg-white px-6 py-4"><Link href={`/admin/campaigns/${selected.id}/setup`} className="border-2 border-[#121212] px-4 py-2.5 text-sm font-semibold hover:bg-[#F0C020]">Open setup</Link><Link href={`/admin/campaigns/${selected.id}`} className="bg-[#1040C0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#D02020]">View details</Link></footer>
      </aside>
    </section> : null}
  </>;
}
