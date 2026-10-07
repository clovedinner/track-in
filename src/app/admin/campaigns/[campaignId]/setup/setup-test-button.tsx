"use client";

import { useState } from "react";

export default function SetupTestButton({ campaignId, enabled }: { campaignId: string; enabled: boolean }) {
  const [state, setState] = useState<{ status: "idle" | "working" | "done" | "error"; message?: string }>({ status: "idle" });
  async function createTestClick() {
    setState({ status: "working" });
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/setup-test`, { method: "POST" });
      const payload = await response.json() as { click?: { clickId: string; destinationUrl: string }; message?: string };
      if (!response.ok || !payload.click) throw new Error(payload.message ?? "Unable to create setup test click.");
      setState({ status: "done", message: `Created ${payload.click.clickId}. Destination includes cid=${payload.click.clickId}.` });
    } catch (error) { setState({ status: "error", message: error instanceof Error ? error.message : "Setup test failed." }); }
  }
  return <div className="border-2 border-[#121212] bg-[#FFFFFF] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Create a test click</h2><p className="mt-1 text-sm text-[#121212]">This creates a marked local setup record only. It never calls an ad platform.</p></div><button type="button" disabled={!enabled || state.status === "working"} onClick={createTestClick} className="border-2 border-[#121212] bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D02020] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">{state.status === "working" ? "Creating…" : "Create test click"}</button></div>{!enabled ? <p className="mt-3 text-xs text-[#D02020]">Enable locally with TRACK_IN_ALLOW_TEST_SETUP=1. Production is always blocked.</p> : null}{state.message ? <p role="status" className={`mt-3 break-words text-sm ${state.status === "error" ? "text-[#D02020]" : "text-[#121212]"}`}>{state.message}</p> : null}</div>;
}
