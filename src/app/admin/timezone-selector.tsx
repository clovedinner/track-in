"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const fallbackZones = ["Africa/Abidjan", "America/Argentina/Buenos_Aires", "America/Chicago", "America/Los_Angeles", "America/New_York", "Asia/Bangkok", "Asia/Jakarta", "Asia/Kolkata", "Asia/Makassar", "Asia/Manila", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/Berlin", "Europe/London", "Pacific/Auckland"];

function labelForTimezone(zone: string): string { return zone.replaceAll("_", " ").replaceAll("/", " / "); }

export default function TimezoneSelector({ initialTimezone }: { initialTimezone: string }) {
  const router = useRouter();
  const [zone, setZone] = useState(initialTimezone || "UTC");
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => {
    const intlWithZones = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    const supported = typeof intlWithZones.supportedValuesOf === "function" ? intlWithZones.supportedValuesOf("timeZone") : fallbackZones;
    return ["UTC", ...supported.filter((value) => value !== "UTC")];
  }, []);

  async function saveTimezone(nextTimezone: string) {
    const previous = zone;
    setZone(nextTimezone);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/profile/timezone", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone: nextTimezone }) });
      if (!response.ok) throw new Error("Timezone update failed");
      router.refresh();
    } catch {
      setZone(previous);
    } finally {
      setSaving(false);
    }
  }

  return <label className="flex items-center gap-2 text-xs font-semibold" title="Timezone used for account dates and reporting"><span className="hidden sm:inline">Timezone</span><select aria-label="Account timezone" value={zone} disabled={saving} onChange={(event) => void saveTimezone(event.target.value)} className="max-w-52 border-2 border-[#121212] bg-white px-2 py-2 text-xs font-semibold disabled:opacity-60">{zones.map((value) => <option key={value} value={value}>{labelForTimezone(value)}</option>)}</select></label>;
}
