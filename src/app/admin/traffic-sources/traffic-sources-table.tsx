"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import TrafficSourceForm from "./traffic-source-form";

export type TrafficSourceRow = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  visits: number;
  conversions: number;
  registration: number;
  ftd: number;
  registrationCustom: boolean;
  ftdCustom: boolean;
};

type Props = { rows: TrafficSourceRow[] };

export default function TrafficSourcesTable({ rows }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const [action, setAction] = useState<"edit" | "duplicate" | null>(null);

  return <>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label="Traffic source actions">
      <p className="text-sm text-[#121212]">{selected ? `Selected: ${selected.name}` : "Select a traffic source to manage it."}</p>
      <div className="flex gap-2">
        <button type="button" disabled={!selected} onClick={() => { if (selected) setAction("edit"); }} className="border-2 border-[#121212] bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] hover:border-[#1040C0] hover:text-[#1040C0] disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
        <button type="button" disabled={!selected} onClick={() => { if (selected) setAction("duplicate"); }} className="border-2 border-[#121212] bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] hover:border-[#1040C0] hover:text-[#1040C0] disabled:cursor-not-allowed disabled:opacity-40">Duplicate</button>
      </div>
    </div>
    <section className="mt-3 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]" aria-label="Traffic source performance">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <caption className="sr-only">Traffic source performance</caption>
        <thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em] text-[#121212]"><tr><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th>{["Name", "Status", "Visits", "Conversions", "Error", "Registration", "FTD"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#121212]">No traffic sources configured yet.</td></tr> : rows.map((row) => <tr key={row.id} className={`border-t-2 border-[#121212] ${selectedId === row.id ? "bg-[#FFF4C2]" : "hover:bg-[#E0E0E0]"}`}>
          <td className="px-4 py-4"><input type="radio" name="selected-traffic-source" checked={selectedId === row.id} onChange={() => setSelectedId(row.id)} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-[#1040C0]" /></td>
          <td className="px-4 py-4"><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-[#121212]">{row.type}</p></td>
          <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold ${row.enabled ? "bg-[#F0C020] text-[#121212]" : "bg-[#E0E0E0] text-[#121212]"}`}>{row.enabled ? "Active" : "Paused"}</span></td>
          <td className="px-4 py-4">{row.visits.toLocaleString()}</td><td className="px-4 py-4">{row.conversions.toLocaleString()}</td><td className="px-4 py-4 text-[#121212]">0</td><td className="px-4 py-4">{row.registration.toLocaleString()} {row.registrationCustom ? <span className="ml-1 text-xs text-[#D02020]">custom</span> : null}</td><td className="px-4 py-4">{row.ftd.toLocaleString()} {row.ftdCustom ? <span className="ml-1 text-xs text-[#D02020]">custom</span> : null}</td>
        </tr>)}</tbody>
      </table>
    </section>
    {action && selected ? <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#121212]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="traffic-source-action-title"><div className="my-4 w-full max-w-[900px] border-2 border-[#121212] bg-white shadow-2xl sm:my-8"><header className="flex items-center justify-between border-b-2 border-[#121212] px-5 py-4 sm:px-7"><h2 id="traffic-source-action-title" className="text-xl font-semibold text-[#121212] sm:text-2xl">{action === "edit" ? "Edit traffic source" : "Duplicate traffic source"}</h2><button type="button" onClick={() => setAction(null)} aria-label="Close traffic source dialog" className="text-2xl leading-none text-[#1040C0]">×</button></header><div className="px-5 py-7 sm:px-7"><TrafficSourceForm source={selected} duplicate={action === "duplicate"} onCreated={() => { setAction(null); setSelectedId(null); router.refresh(); }} /></div></div></section> : null}
  </>;
}
