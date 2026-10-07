"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type TrafficSource = { id: string; name: string; type: string; enabled: boolean };
type Offer = { id: string; name: string; s2sPostbackUrl: string | null };
type CreatedCampaign = { id: string; name: string; slug: string; status: string; destinationUrl: string; defaultCurrency: string; allowedTrackingParameters: unknown };

const fieldClass = "mt-2 block w-full border border-[#c8c3b8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#a34f2d] focus:ring-2 focus:ring-[#a34f2d]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]";

export default function CampaignForm() {
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreatedCampaign | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workflow, setWorkflow] = useState<"simple" | "path" | "offers-only">("simple");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/traffic-sources", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load traffic sources.");
        return (await response.json()) as { trafficSources?: TrafficSource[] };
      })
      .then((body) => { if (!cancelled) setSources((body.trafficSources ?? []).filter((source) => source.enabled)); })
      .catch(() => { if (!cancelled) setSourceError("Traffic sources could not be loaded. You can still create a campaign without one."); });
    fetch("/api/admin/offers", { headers: { accept: "application/json" } })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load offers."); return (await response.json()) as { offers?: Offer[] }; })
      .then((body) => { if (!cancelled) setOffers(body.offers ?? []); })
      .catch(() => { if (!cancelled) setOffers([]); });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const parameters = String(form.get("allowedTrackingParameters") ?? "")
      .split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
    const body = {
      slug: String(form.get("slug") ?? "").trim().toLowerCase(),
      name: String(form.get("name") ?? "").trim(),
      destinationUrl: String(form.get("destinationUrl") ?? "").trim(),
      status: String(form.get("status") ?? "paused"),
      defaultCurrency: String(form.get("defaultCurrency") ?? "IDR").trim().toUpperCase(),
      trafficSourceId: String(form.get("trafficSourceId") ?? "") || undefined,
      offerId: String(form.get("offerId") ?? "") || undefined,
      allowedTrackingParameters: parameters,
    };
    try {
      const response = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { campaign?: CreatedCampaign; error?: { message?: string } };
      if (!response.ok || !result.campaign) throw new Error(result.error?.message ?? "Unable to create campaign.");
      setSuccess(result.campaign);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create campaign.");
    } finally { setSubmitting(false); }
  }

  if (success) {
    return (
      <section className="mt-8 border border-[#8eb49a] bg-[#f4fbf4] px-6 py-7" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#285b38]">Campaign created</p>
        <h2 className="mt-3 text-2xl font-semibold">{success.name}</h2>
        <p className="mt-2 text-sm text-[#59636c]">The campaign is ready for setup. Generate the platform URL and GTM/postback artifacts before sending traffic.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={`/admin/campaigns/${success.id}/setup`} className="bg-[#17202a] px-4 py-2.5 text-white hover:bg-[#a34f2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">Generate setup artifacts →</Link>
          <Link href={`/admin/campaigns/${success.id}`} className="px-1 py-2.5 text-[#a34f2d] underline underline-offset-4">View campaign</Link>
          <button type="button" onClick={() => setSuccess(null)} className="px-1 py-2.5 text-[#59636c] underline underline-offset-4">Create another</button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
      {error ? <div role="alert" className="border border-[#a34f2d] bg-[#fffaf5] px-4 py-3 text-sm text-[#8b3c22]">{error}</div> : null}
      {sourceError ? <p className="border border-[#c8a86b] bg-[#fff9e9] px-4 py-3 text-sm text-[#6c5a2f]">{sourceError}</p> : null}
      <section className="border border-[#c8c3b8] bg-[#faf8f3] p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Campaign identity</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>Name<input required name="name" maxLength={200} className={fieldClass} placeholder="Client registration funnel" /></label>
          <label className={labelClass}>Slug<p className="mt-1 normal-case tracking-normal text-[11px] font-normal text-[#59636c]">Lowercase letters, numbers, and hyphens.</p><input required name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} className={fieldClass} placeholder="client-registration" /></label>
        </div>
      </section>
      <section className="border border-[#c8c3b8] bg-[#faf8f3] p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Destination and reporting</h2>
        <div className="mt-5 space-y-5">
          <label className={labelClass}>Money-site destination URL<p className="mt-1 normal-case tracking-normal text-[11px] font-normal text-[#59636c]">Must be an HTTPS URL. The tracker appends <code>cid</code>.</p><input required name="destinationUrl" type="url" className={fieldClass} placeholder="https://money.example.com/register" /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Default currency<input required name="defaultCurrency" defaultValue="IDR" maxLength={3} pattern="[A-Za-z]{3}" className={`${fieldClass} uppercase`} /></label>
            <label className={labelClass}>Initial status<select name="status" defaultValue="paused" className={fieldClass}><option value="paused">Paused — configure before traffic</option><option value="active">Active — accept traffic now</option></select></label>
          </div>
          <label className={labelClass}>Traffic source<select name="trafficSourceId" defaultValue="" className={fieldClass}><option value="">No traffic source yet</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} ({source.type})</option>)}</select></label>
        </div>
      </section>
      <section className="border border-[#c8c3b8] bg-[#faf8f3] p-5 sm:p-7" aria-labelledby="campaign-workflow-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="campaign-workflow-heading" className="text-xl font-semibold">Campaign flow</h2><p className="mt-2 text-sm leading-6 text-[#59636c]">Choose the Voluum-style setup your client uses. You can finish the destinations and offers after creating the campaign.</p></div>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#59636c]">Step 1 of 2</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[{ id: "simple", title: "Simple", text: "Two-step funnel with multiple landers and offers." }, { id: "path", title: "Path", text: "Route traffic through an ordered path." }, { id: "offers-only", title: "Offers Only", text: "Send traffic directly to selected offers." }].map((option) => <label key={option.id} className={`min-h-[118px] cursor-pointer border p-4 transition-colors ${workflow === option.id ? "border-[#a34f2d] bg-[#fffaf5]" : "border-[#c8c3b8] bg-white hover:border-[#8d877c]"}`}><input className="sr-only" type="radio" name="workflow" value={option.id} checked={workflow === option.id} onChange={() => setWorkflow(option.id as typeof workflow)} /><span className="flex items-start gap-3"><span aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${workflow === option.id ? "border-[#a34f2d] bg-[#a34f2d] shadow-[inset_0_0_0_3px_#fffaf5]" : "border-[#8d877c]"}`} /><span><strong className="block text-sm">{option.title}</strong><span className="mt-1 block text-xs leading-5 text-[#59636c]">{option.text}</span></span></span></label>)}
        </div>
        <div className="mt-5 border-t border-[#ded9cf] pt-5">
          <label className={labelClass}>Offer selection <span className="normal-case tracking-normal font-normal">(optional, one primary offer)</span><select name="offerId" className={fieldClass} defaultValue=""><option value="">No primary offer yet</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}{offer.s2sPostbackUrl ? " · S2S configured" : ""}</option>)}</select></label>
          <p className="mt-2 text-xs leading-5 text-[#59636c]">Simple and Path can be expanded with multiple destinations in the setup step. Offers Only uses the selected primary offer for this campaign.</p>
        </div>
      </section>
      <section className="border border-[#c8c3b8] bg-[#faf8f3] p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Allowed platform parameters</h2>
        <p className="mt-2 text-sm leading-6 text-[#59636c]">Only these inbound query parameters are preserved in the click record and forwarded to the money site. Separate names with commas or spaces.</p>
        <label className={`${labelClass} mt-5 block`}>Parameter names<input name="allowedTrackingParameters" className={fieldClass} placeholder="click_id campaign_id ad_id" /></label>
        <p className="mt-3 text-xs text-[#59636c]">Do not add <code>cid</code>; it is reserved for the tracker-generated click ID.</p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/campaigns" className="text-sm font-semibold text-[#59636c] underline underline-offset-4">Cancel</Link>
        <button disabled={submitting} type="submit" className="border border-[#17202a] bg-[#17202a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#a34f2d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]">{submitting ? "Creating…" : "Create campaign"}</button>
      </div>
    </form>
  );
}
