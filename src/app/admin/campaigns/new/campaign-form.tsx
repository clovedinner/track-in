"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type TrafficSource = { id: string; name: string; type: string; enabled: boolean };
type Offer = { id: string; name: string; offerUrl: string | null };
type CreatedCampaign = { id: string; name: string };

const fieldClass = "mt-2 block w-full border border-[#bfc7d4] bg-white px-3 py-2.5 text-sm text-[#17202a] outline-none transition focus:border-[#314d8b] focus:ring-2 focus:ring-[#314d8b]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]";
const labelClass = "text-xs font-semibold text-[#3e4855]";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || `campaign-${Date.now()}`;
}

export default function CampaignForm() {
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreatedCampaign | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/traffic-sources", { headers: { accept: "application/json" } }).then(async (response) => {
        if (!response.ok) throw new Error("Traffic sources could not be loaded.");
        return (await response.json()) as { trafficSources?: TrafficSource[] };
      }),
      fetch("/api/admin/offers", { headers: { accept: "application/json" } }).then(async (response) => {
        if (!response.ok) throw new Error("Offers could not be loaded.");
        return (await response.json()) as { offers?: Offer[] };
      }),
    ]).then(([sourceBody, offerBody]) => {
      if (!cancelled) {
        setSources((sourceBody.trafficSources ?? []).filter((source) => source.enabled));
        setOffers(offerBody.offers ?? []);
        setLoadingLists(false);
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : "Selectors could not be loaded.");
        setLoadingLists(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const trafficSourceId = String(form.get("trafficSourceId") ?? "");
    const offerId = String(form.get("offerId") ?? "");
    const body = {
      name,
      slug: slugify(name),
      trafficSourceId,
      offerId,
      status: "paused",
      defaultCurrency: "USD",
      destinationUrl: "https://pending.invalid/",
      allowedTrackingParameters: [],
    };
    try {
      const response = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { campaign?: CreatedCampaign; error?: { message?: string } };
      if (!response.ok || !result.campaign) throw new Error(result.error?.message ?? "Unable to create campaign.");
      setSuccess(result.campaign);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="fixed inset-0 z-20 flex items-center justify-center bg-[#17202a]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="campaign-created-title">
        <div className="w-full max-w-xl border border-[#bfc7d4] bg-white p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#285b38]">Campaign created</p>
          <h2 id="campaign-created-title" className="mt-3 text-2xl font-semibold text-[#17202a]">{success.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#59636c]">The campaign is paused until its destination and tracking setup are completed.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3 text-sm font-semibold">
            <Link href={`/admin/campaigns/${success.id}/setup`} className="bg-[#314d8b] px-4 py-2.5 text-white hover:bg-[#243968] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">Open setup</Link>
            <Link href="/admin/campaigns" className="border border-[#bfc7d4] px-4 py-2.5 text-[#17202a] hover:bg-[#f4f6f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">Back to campaigns</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#17202a]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title">
      <div className="my-4 w-full max-w-[760px] border border-[#bfc7d4] bg-white shadow-2xl sm:my-10">
        <header className="flex items-center justify-between border-b border-[#bfc7d4] px-5 py-4 sm:px-7">
          <h1 id="new-campaign-title" className="text-xl font-semibold text-[#17202a] sm:text-2xl">New campaign</h1>
          <Link href="/admin/campaigns" aria-label="Close new campaign" className="text-2xl leading-none text-[#314d8b] hover:text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">×</Link>
        </header>
        <div className="border-b border-[#d7dce5] px-5 sm:px-7"><div className="border-b-2 border-[#314d8b] py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#314d8b]">General</div></div>
        <form onSubmit={submit} className="space-y-6 px-5 py-7 sm:px-7" noValidate>
          {error ? <div role="alert" className="border border-[#a34f2d] bg-[#fff7f2] px-4 py-3 text-sm text-[#8b3c22]">{error}</div> : null}
          <div><h2 className="text-lg font-semibold text-[#17202a]">General</h2><p className="mt-1 text-sm text-[#59636c]">Choose the two existing configurations this campaign will use.</p></div>
          <label className={labelClass}>Name<input required name="name" maxLength={200} className={fieldClass} placeholder="Campaign name" autoFocus /></label>
          <label className={labelClass}>Traffic source<select required name="trafficSourceId" defaultValue="" className={fieldClass} disabled={loadingLists}><option value="">{loadingLists ? "Loading traffic sources…" : "Select traffic source"}</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} ({source.type})</option>)}</select></label>
          <label className={labelClass}>Offer<select required name="offerId" defaultValue="" className={fieldClass} disabled={loadingLists}><option value="">{loadingLists ? "Loading offers…" : "Select offer"}</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label>
          {!loadingLists && sources.length === 0 ? <p className="text-sm text-[#8b3c22]">Create an enabled traffic source before creating a campaign.</p> : null}
          {!loadingLists && offers.length === 0 ? <p className="text-sm text-[#8b3c22]">Create an offer before creating a campaign.</p> : null}
          <footer className="-mx-5 flex items-center justify-between border-t border-[#d7dce5] px-5 pt-5 sm:-mx-7 sm:px-7">
            <Link href="/admin/campaigns" className="border border-transparent px-4 py-2.5 text-sm font-semibold text-[#314d8b] hover:bg-[#f4f6f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">Cancel</Link>
            <button disabled={submitting || loadingLists || sources.length === 0 || offers.length === 0} type="submit" className="bg-[#314d8b] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#243968] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">{submitting ? "Saving…" : "Save"}</button>
          </footer>
        </form>
      </div>
    </section>
  );
}
