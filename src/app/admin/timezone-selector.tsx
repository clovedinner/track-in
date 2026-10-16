"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const fallbackZones = ["Africa/Abidjan", "America/Argentina/Buenos_Aires", "America/Chicago", "America/Los_Angeles", "America/New_York", "Asia/Bangkok", "Asia/Jakarta", "Asia/Kolkata", "Asia/Makassar", "Asia/Manila", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/Berlin", "Europe/London", "Pacific/Auckland"];

function getZones() {
  const intlWithZones = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const supported = typeof intlWithZones.supportedValuesOf === "function" ? intlWithZones.supportedValuesOf("timeZone") : fallbackZones;
  return ["UTC", ...supported.filter((value) => value !== "UTC")];
}

function getUtcOffset(timezone: string): string {
  if (timezone === "UTC") return "UTC+00:00";
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(new Date());
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "UTC+00:00";
  return `UTC${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

function labelForTimezone(timezone: string): string {
  return timezone === "UTC" ? "UTC" : `${timezone.replaceAll("_", " ")} · ${getUtcOffset(timezone)}`;
}

export default function TimezoneSelector({ initialTimezone }: { initialTimezone: string }) {
  const router = useRouter();
  const [zone, setZone] = useState(initialTimezone || "UTC");
  const [draft, setDraft] = useState(initialTimezone || "UTC");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => getZones(), []);
  const filteredZones = zones.filter((value) => labelForTimezone(value).toLowerCase().includes(query.trim().toLowerCase()));
  const changed = draft !== zone;

  function openPicker() {
    setDraft(zone);
    setQuery("");
    setError(null);
    setOpen(true);
  }

  async function saveTimezone() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profile/timezone", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone: draft }) });
      if (!response.ok) throw new Error("Timezone could not be saved.");
      setZone(draft);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Timezone could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="relative">
    <button type="button" onClick={openPicker} aria-haspopup="dialog" aria-expanded={open} className="flex min-h-10 items-center gap-2 border-2 border-[#121212] bg-white px-3 py-2 text-left text-xs font-semibold shadow-[2px_2px_0_#121212] hover:bg-[#F0C020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]"><span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-[#545454] sm:inline">Timezone</span><span className="max-w-40 truncate">{labelForTimezone(zone)}</span><span aria-hidden="true" className="text-[10px]">▾</span></button>
    {open ? <div role="dialog" aria-label="Choose account timezone" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] border-2 border-[#121212] bg-white p-3 text-[#121212] shadow-[5px_5px_0_#121212]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D02020]">Account timezone</p><p className="mt-1 text-xs text-[#545454]">Used across dates and reports.</p></div><button type="button" onClick={() => setOpen(false)} className="border-2 border-[#121212] px-2 py-1 text-sm font-bold hover:bg-[#F0C020]" aria-label="Close timezone picker">×</button></div>
      <label className="mt-3 block"><span className="sr-only">Search timezones</span><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city or UTC offset" className="w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none focus:border-[#1040C0]" /></label>
      <div className="mt-2 max-h-64 overflow-y-auto border-2 border-[#121212]" role="listbox" aria-label="Timezones">{filteredZones.length === 0 ? <p className="px-3 py-4 text-sm">No timezone matches.</p> : filteredZones.map((value) => <button type="button" role="option" aria-selected={draft === value} key={value} onClick={() => setDraft(value)} className={`block w-full border-b border-[#D8D8D8] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[#FFF4C2] ${draft === value ? "bg-[#F0C020] font-bold" : "bg-white"}`}>{labelForTimezone(value)}</button>)}</div>
      {error ? <p role="alert" className="mt-3 border-2 border-[#D02020] px-3 py-2 text-xs text-[#D02020]">{error}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-[#545454]">Selected: {labelForTimezone(draft)}</span><button type="button" disabled={!changed || saving} onClick={() => void saveTimezone()} className="min-h-10 border-2 border-[#121212] bg-[#1040C0] px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_#121212] hover:bg-[#D02020] disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving…" : "Save timezone"}</button></div>
    </div> : null}
  </div>;
}
