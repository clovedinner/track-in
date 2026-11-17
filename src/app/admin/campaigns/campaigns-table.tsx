"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import CampaignForm from "./new/campaign-form";
import type { CampaignListRow } from "@/lib/admin/campaign-views";
import type { CustomConversionColumn } from "@/lib/admin/custom-conversion-metrics";


function statusClass(status: string) {
  return status === "active" ? "bg-[#F0C020] text-[#121212]" : "bg-[#E0E0E0] text-[#121212]";
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "-").slice(0, 90) || `campaign-copy-${Date.now()}`;
}

export default function CampaignsTable({ rows, timezone, customConversions }: { rows: CampaignListRow[]; timezone: string; customConversions: CustomConversionColumn[] }) {
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
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth: `${1050 + customConversions.length * 120}px` }}>
        <caption className="sr-only">Campaign performance</caption>
        <thead className="bg-[#6F7D99] text-xs uppercase tracking-[0.09em] text-white"><tr>
          <th className="w-12 px-3 py-3"><span className="sr-only">Select</span></th>
          {['Campaign', 'Status', 'Mode', 'Traffic source', 'Visits', 'Conversions'].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}
          {customConversions.map((conversion) => <th key={conversion.id} className="px-3 py-3 text-right font-semibold">{conversion.name}</th>)}
          <th className="px-3 py-3 font-semibold">Created</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className={`border-t border-[#C5CBD5] align-top ${selectedId === row.id ? "bg-[#FFF4C2]" : "odd:bg-white even:bg-[#F4F5F7] hover:bg-[#E7EBF2]"}`}>
          <td className="px-3 py-3"><input type="checkbox" checked={selectedId === row.id} onChange={() => select(row.id)} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-[#1040C0]" /></td>
          <td className="max-w-[320px] px-3 py-3"><Link href={`/admin/campaigns/${row.id}`} className="font-semibold hover:text-[#D02020] hover:underline">{row.name}</Link><p className="mt-1 font-mono text-[11px] text-[#3e4855]">{row.slug}</p></td>
          <td className="px-3 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
          <td className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em]">{row.trackingMode}</td>
          <td className="max-w-[180px] truncate px-3 py-3 text-xs">{row.trafficSourceName ?? "Not connected"}</td>
          <td className="px-3 py-3 font-mono">{row.clicks.toLocaleString()}</td>
          <td className="px-3 py-3 font-mono">{row.conversions.toLocaleString()}</td>
          {customConversions.map((conversion) => <td key={conversion.id} className="px-3 py-3 text-right font-mono">{(row.customConversionCounts[conversion.id] ?? 0).toLocaleString()}</td>)}
          <td className="whitespace-nowrap px-3 py-3 text-xs text-[#3e4855]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: timezone }).format(row.createdAt)} {timezone}</td>
        </tr>)}</tbody>
      </table>
      {rows.length === 0 ? <div className="border-t-2 border-[#121212] px-6 py-10"><h2 className="text-lg font-semibold">No campaigns match these filters.</h2><p className="mt-2 text-sm text-[#121212]">Create a campaign or clear the search and status filters.</p></div> : null}
    </section>
    {drawer && selected && (
      <CampaignForm key={selected.id} edit={{
        campaign: selected,
        onClose: () => setDrawer(false),
        onSaved: () => { setDrawer(false); router.refresh(); },
      }} />
    )}
  </>;
}
