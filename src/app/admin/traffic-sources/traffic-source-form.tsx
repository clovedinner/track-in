"use client";

import { FormEvent, useState } from "react";

const fieldClass = "mt-2 block w-full border border-[#c8c3b8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#a34f2d] focus:ring-2 focus:ring-[#a34f2d]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]";

export default function TrafficSourceForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const parameters = String(form.get("parameters") ?? "").split(/[\s,]+/).map((name) => name.trim()).filter(Boolean).slice(0, 10).map((name) => ({ name, token: `{${name}}` }));
    const postbackByEventType: Record<string, string> = {};
    for (const eventType of ["registration", "ftd"]) {
      const url = String(form.get(`${eventType}Postback`) ?? "").trim();
      if (url) postbackByEventType[eventType] = url;
    }
    const body = {
      name: String(form.get("name") ?? "").trim(), type: String(form.get("type") ?? "trafficstars"), enabled: true,
      configuration: { postbackUrl: String(form.get("postbackUrl") ?? "").trim(), postbackByEventType, parameters, costCurrency: "USD" },
    };
    try {
      const response = await fetch("/api/admin/traffic-sources", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Unable to create traffic source.");
      setDone(true); event.currentTarget.reset();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to create traffic source."); }
    finally { setSubmitting(false); }
  }

  return <form onSubmit={submit} className="space-y-6" noValidate>
    {error ? <div role="alert" className="border border-[#a34f2d] bg-[#fffaf5] px-4 py-3 text-sm text-[#8b3c22]">{error}</div> : null}
    {done ? <div role="status" className="border border-[#8eb49a] bg-[#f4fbf4] px-4 py-3 text-sm text-[#285b38]">Traffic source created and ready to attach to a campaign.</div> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <label className={labelClass}>Name<input required name="name" maxLength={200} className={fieldClass} placeholder="TrafficStars Indonesia" /></label>
      <label className={labelClass}>Platform<select name="type" className={fieldClass}><option value="trafficstars">TrafficStars</option><option value="propeller">PropellerAds</option><option value="trafficjunky">TrafficJunky</option></select></label>
    </div>
    <label className={labelClass}>Default postback URL<input required type="url" name="postbackUrl" className={fieldClass} placeholder="https://ad-platform.example/postback?clickid={clickid}" /><span className="mt-2 block normal-case tracking-normal text-[11px] font-normal">Use the platform URL and macros supplied by the client.</span></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className={labelClass}>Registration postback URL<input type="url" name="registrationPostback" className={fieldClass} placeholder="Optional event-specific URL" /></label>
      <label className={labelClass}>FTD postback URL<input type="url" name="ftdPostback" className={fieldClass} placeholder="Optional event-specific URL" /></label>
    </div>
    <label className={labelClass}>Event selector / parameters<input name="parameters" className={fieldClass} placeholder="clickid campaign_id ad_id" /><span className="mt-2 block normal-case tracking-normal text-[11px] font-normal">Up to 10 names, separated by spaces or commas. These are saved as the platform parameter allowlist.</span></label>
    <p className="text-xs text-[#59636c]">Cost currency: <strong className="text-[#17202a]">USD</strong></p>
    <div className="flex justify-end"><button disabled={submitting} type="submit" className="border border-[#17202a] bg-[#17202a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#a34f2d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">{submitting ? "Saving…" : "Create traffic source"}</button></div>
  </form>;
}
