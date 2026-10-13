"use client";

import { useState } from "react";

export default function StatusControl({ campaignId, status }: { campaignId: string; status: string }) {
  const [current, setCurrent] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  async function setStatus(next: "active" | "paused") {
    setWorking(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      const body = await response.json() as { campaign?: { status: string }; error?: { message?: string } };
      if (!response.ok || !body.campaign) throw new Error(body.error?.message ?? "Unable to update campaign.");
      setCurrent(body.campaign.status); setMessage(next === "active" ? "Campaign is live." : "Campaign paused.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update campaign."); }
    finally { setWorking(false); }
  }
  return <div className="flex flex-wrap items-center gap-2 text-sm"><button type="button" disabled={working || current === "active"} onClick={() => setStatus("active")} className="border-2 border-[#121212] bg-[#1040C0] px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{working ? "Saving…" : "Activate"}</button><button type="button" disabled={working || current === "paused"} onClick={() => setStatus("paused")} className="border-2 border-[#121212] bg-white px-3 py-2 font-semibold text-[#121212] disabled:cursor-not-allowed disabled:opacity-50">Pause</button>{message ? <span role="status" className="text-xs text-[#121212]">{message}</span> : null}</div>;
}
