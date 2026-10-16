"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import TrafficSourceForm from "./traffic-source-form";
import type { CustomConversionColumn } from "@/lib/admin/custom-conversion-metrics";

export type TrafficSourceRow = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  visits: number;
  conversions: number;
  customConversionCounts: Record<string, number>;
};

type Props = { rows: TrafficSourceRow[]; customConversions: CustomConversionColumn[] };

export default function TrafficSourcesTable({ rows, customConversions }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const [action, setAction] = useState<"edit" | "duplicate" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || row.name.toLowerCase().includes(term);
      const matchesStatus = status === "all" || (status === "active" ? row.enabled : !row.enabled);
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);
  const total = (key: "visits" | "conversions") => filteredRows.reduce((sum, row) => sum + row[key], 0);

  return <>
    <section className="mt-8 border-2 border-[#121212] bg-white" aria-label="Traffic source workspace">
      <div className="border-b-2 border-[#121212] bg-[#E0E0E0] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em]">Traffic source performance</p><p className="mt-1 text-sm">Select one source to edit or duplicate it. Search by name.</p></div>
          <div className="flex gap-2" aria-label="Traffic source actions">
        <button type="button" disabled={!selected} onClick={() => { if (selected) setAction("edit"); }} className="border-2 border-[#121212] bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] hover:border-[#1040C0] hover:text-[#1040C0] disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
        <button type="button" disabled={!selected} onClick={() => { if (selected) setAction("duplicate"); }} className="border-2 border-[#121212] bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] hover:border-[#1040C0] hover:text-[#1040C0] disabled:cursor-not-allowed disabled:opacity-40">Duplicate</button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_auto]">
          <label className="sr-only" htmlFor="traffic-source-search">Search traffic sources</label><input id="traffic-source-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="border-2 border-[#121212] bg-white px-3 py-2 text-sm" />
          <label className="sr-only" htmlFor="traffic-source-status">Filter by status</label><select id="traffic-source-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="border-2 border-[#121212] bg-white px-3 py-2 text-sm"><option value="all">All statuses</option><option value="active">Active only</option><option value="paused">Paused only</option></select>
          <p className="flex items-center px-1 text-xs">Showing {filteredRows.length} of {rows.length}</p>
        </div>
      </div>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth: `${1080 + customConversions.length * 120}px` }}>
        <caption className="sr-only">Traffic source performance</caption>
        <thead className="bg-[#6C7A96] text-xs uppercase tracking-[0.1em] text-white"><tr><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th>{["Traffic source", "Status", "Visits", "Conversions", "Errors"].map((heading) => <th key={heading} className="border-l border-white/40 px-4 py-3 font-semibold">{heading}</th>)}{customConversions.map((conversion) => <th key={conversion.id} className="border-l border-white/40 px-4 py-3 font-semibold">{conversion.name}</th>)}<th className="border-l border-white/40 px-4 py-3 font-semibold">Configuration</th></tr></thead>
        <tbody>{filteredRows.length === 0 ? <tr><td colSpan={7 + customConversions.length} className="px-4 py-12 text-center text-sm text-[#121212]">{rows.length === 0 ? "No traffic sources configured yet." : "No traffic sources match these filters."}</td></tr> : filteredRows.map((row) => <tr key={row.id} className={`border-t border-[#C9CDD5] ${selectedId === row.id ? "bg-[#C9D8F8]" : "odd:bg-white even:bg-[#F4F5F7] hover:bg-[#FFF4C2]"}`}>
          <td className="px-4 py-4"><input type="radio" name="selected-traffic-source" checked={selectedId === row.id} onChange={() => setSelectedId(row.id)} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-[#1040C0]" /></td>
          <td className="px-4 py-3"><p className="font-semibold">{row.name}</p></td>
          <td className="border-l border-[#C9CDD5] px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-semibold ${row.enabled ? "bg-[#F0C020] text-[#121212]" : "bg-[#E0E0E0] text-[#121212]"}`}>{row.enabled ? "Active" : "Paused"}</span></td>
          <td className="border-l border-[#C9CDD5] px-4 py-3">{row.visits.toLocaleString()}</td><td className="border-l border-[#C9CDD5] px-4 py-3">{row.conversions.toLocaleString()}</td><td className="border-l border-[#C9CDD5] px-4 py-3 text-[#545454]">—</td>{customConversions.map((conversion) => <td key={conversion.id} className="border-l border-[#C9CDD5] px-4 py-3">{(row.customConversionCounts[conversion.id] ?? 0).toLocaleString()}</td>)}<td className="border-l border-[#C9CDD5] px-4 py-3 text-xs text-[#545454]">{row.enabled ? "Ready" : "Paused"}</td>
        </tr>)}</tbody>
        <tfoot className="bg-[#6C7A96] text-sm font-semibold text-white"><tr><td className="px-4 py-3" /><td className="px-4 py-3">Total ({filteredRows.length} {filteredRows.length === 1 ? "source" : "sources"})</td><td className="border-l border-white/40 px-4 py-3" /><td className="border-l border-white/40 px-4 py-3">{total("visits").toLocaleString()}</td><td className="border-l border-white/40 px-4 py-3">{total("conversions").toLocaleString()}</td><td className="border-l border-white/40 px-4 py-3">—</td>{customConversions.map((conversion) => <td key={conversion.id} className="border-l border-white/40 px-4 py-3">{filteredRows.reduce((sum, row) => sum + (row.customConversionCounts[conversion.id] ?? 0), 0).toLocaleString()}</td>)}<td className="border-l border-white/40 px-4 py-3" /></tr></tfoot>
      </table>
    </div></section>
    {action && selected ? <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#121212]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="traffic-source-action-title"><div className="my-4 w-full max-w-[900px] border-2 border-[#121212] bg-white shadow-2xl sm:my-8"><header className="flex items-center justify-between border-b-2 border-[#121212] px-5 py-4 sm:px-7"><h2 id="traffic-source-action-title" className="text-xl font-semibold text-[#121212] sm:text-2xl">{action === "edit" ? "Edit traffic source" : "Duplicate traffic source"}</h2><button type="button" onClick={() => setAction(null)} aria-label="Close traffic source dialog" className="text-2xl leading-none text-[#1040C0]">×</button></header><div className="px-5 py-7 sm:px-7"><TrafficSourceForm source={selected} duplicate={action === "duplicate"} onCreated={() => { setAction(null); setSelectedId(null); router.refresh(); }} /></div></div></section> : null}
  </>;
}
