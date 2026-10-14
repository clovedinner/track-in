"use client";

import { useState } from "react";

const zones = [
  ["UTC", "UTC"],
  ["Jakarta (UTC+7)", "Asia/Jakarta"],
  ["Singapore (UTC+8)", "Asia/Singapore"],
  ["London", "Europe/London"],
  ["New York", "America/New_York"],
] as const;

export default function TimezoneSelector() {
  const [zone, setZone] = useState(() => typeof window === "undefined" ? "UTC" : window.localStorage.getItem("trakio-timezone") ?? "UTC");
  return <label className="flex items-center gap-2 text-xs font-semibold" title="Choose the timezone used for dashboard dates">
    <span className="hidden sm:inline">Timezone</span>
    <select aria-label="Dashboard timezone" value={zone} onChange={(event) => { setZone(event.target.value); window.localStorage.setItem("trakio-timezone", event.target.value); window.dispatchEvent(new CustomEvent("trakio-timezone-change", { detail: event.target.value })); }} className="border-2 border-[#121212] bg-white px-2 py-2 text-xs font-semibold">
      {zones.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}
