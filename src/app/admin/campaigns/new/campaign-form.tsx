"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type TrafficSource = { id: string; name: string; type: string };
type Offer = { id: string; name: string };
type CampaignToEdit = {
  id: string;
  name: string;
  trafficSourceId: string | null;
  trafficSourceName: string | null;
  offerId: string | null;
  trackingMode: string;
};
type EditMode = { campaign: CampaignToEdit; onClose: () => void; onSaved: () => void };
type CreatedCampaign = { id: string; name: string };

const fieldClass = "mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm text-[#121212] outline-none transition focus:border-[#1040C0] focus:ring-2 focus:ring-[#1040C0]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]";
const labelClass = "text-xs font-semibold text-[#3e4855]";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || `campaign-${Date.now()}`;
}

export default function CampaignForm({ edit }: { edit?: EditMode }) {
  const campaign = edit?.campaign;
  const [sourceId, setSourceId] = useState(campaign?.trafficSourceId ?? "");
  const [offerId, setOfferId] = useState(campaign?.offerId ?? "");
  const [listFailed, setListFailed] = useState(false);
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreatedCampaign | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/campaigns/options", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Campaign options could not be loaded.");
        return await response.json() as { trafficSources: TrafficSource[]; offers: Offer[] };
      })
      .then(({ trafficSources, offers }) => {
        if (!cancelled) {
          setSources(trafficSources);
          setOffers(offers);
          setLoadingLists(false);
        }
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setListFailed(true);
        setError(loadError instanceof Error ? loadError.message : "Selectors could not be loaded.");
        setLoadingLists(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const canSave = !submitting && !loadingLists && !listFailed &&
    (campaign ? (sourceId !== "" || campaign.trafficSourceId === null) && (offerId !== "" || campaign.offerId === null) : sourceId !== "" && offerId !== "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const trafficSourceId = sourceId;
    const trackingMode = String(form.get("trackingMode") ?? "redirect");
    const body = campaign ? {
      ...(name !== campaign.name ? { name } : {}),
      ...(trafficSourceId !== (campaign.trafficSourceId ?? "") ? { trafficSourceId } : {}),
      ...(offerId !== (campaign.offerId ?? "") ? { offerId } : {}),
      ...(trackingMode !== campaign.trackingMode ? { trackingMode } : {}),
    } : {
      name,
      slug: slugify(name),
      trafficSourceId,
      offerId,
      trackingMode,
      status: "active",
      defaultCurrency: "USD",
      destinationUrl: "https://pending.invalid/",
      allowedTrackingParameters: [],
    };
    try {
      if (edit && Object.keys(body).length === 0) {
        edit.onClose();
        return;
      }
      const response = await fetch(campaign ? `/api/admin/campaigns/${campaign.id}` : "/api/admin/campaigns", { method: campaign ? "PATCH" : "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { campaign?: CreatedCampaign; error?: { message?: string } };
      if (!response.ok || !result.campaign) throw new Error(result.error?.message ?? "Unable to save campaign.");
      if (edit) edit.onSaved();
      else setSuccess(result.campaign);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="fixed inset-0 z-20 flex items-center justify-center bg-[#121212]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="campaign-created-title">
        <div className="w-full max-w-xl border-2 border-[#121212] bg-white p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#121212]">Campaign created</p>
          <h2 id="campaign-created-title" className="mt-3 text-2xl font-semibold text-[#121212]">{success.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#121212]">The campaign is active and ready to receive visits.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3 text-sm font-semibold">
            <Link href={`/admin/campaigns/${success.id}/setup`} className="bg-[#1040C0] px-4 py-2.5 text-white hover:bg-[#1040C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Open setup</Link>
            <Link href="/admin/campaigns" className="border-2 border-[#121212] px-4 py-2.5 text-[#121212] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Back to campaigns</Link>
          </div>
        </div>
      </section>
    );
  }

  const cancelClass = "border-2 border-transparent px-4 py-2.5 text-sm font-semibold text-[#1040C0] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]";
  return (
    <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#121212]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title">
      <div className="my-4 w-full max-w-[760px] border-2 border-[#121212] bg-white shadow-2xl sm:my-10">
        <header className="flex items-center justify-between border-b-2 border-[#121212] px-5 py-4 sm:px-7">
          <h1 id="new-campaign-title" className="text-xl font-semibold text-[#121212] sm:text-2xl">{edit ? "Edit campaign" : "New campaign"}</h1>
          {edit ? <button type="button" onClick={edit.onClose} disabled={submitting} aria-label="Close edit campaign" className="text-2xl text-[#1040C0]">&times;</button> : <Link href="/admin/campaigns" aria-label="Close new campaign" className="text-2xl leading-none text-[#1040C0] hover:text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</Link>}
        </header>
        <div className="border-b-2 border-[#121212] px-5 sm:px-7"><div className="border-b-2 border-[#1040C0] py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#1040C0]">General</div></div>
        <form onSubmit={submit} className="space-y-6 px-5 py-7 sm:px-7">
          {error ? <div role="alert" className="border-2 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
          <div><h2 className="text-lg font-semibold text-[#121212]">General</h2><p className="mt-1 text-sm text-[#121212]">Choose the two existing configurations this campaign will use.</p></div>
          <label className={labelClass}>Name<input required name="name" defaultValue={campaign?.name ?? ""} maxLength={200} className={fieldClass} placeholder="Campaign name" autoFocus /></label>
          <label className={labelClass}>Traffic source<select name="trafficSourceId" value={sourceId} onChange={(event) => setSourceId(event.target.value)} className={fieldClass} disabled={loadingLists}><option value="">{loadingLists ? "Loading traffic sources…" : "Select traffic source"}</option>{campaign?.trafficSourceId && !sources.some((source) => source.id === campaign.trafficSourceId) && <option value={campaign.trafficSourceId}>{campaign.trafficSourceName ?? "Saved traffic source"}{loadingLists ? "" : " (unavailable)"}</option>}{sources.map((source) => <option key={source.id} value={source.id}>{source.name} ({source.type})</option>)}</select></label>
          <label className={labelClass}>Offer<select name="offerId" value={offerId} onChange={(event) => setOfferId(event.target.value)} className={fieldClass} disabled={loadingLists}><option value="">{loadingLists ? "Loading offers…" : "Select offer"}</option>{campaign?.offerId && !offers.some((offer) => offer.id === campaign.offerId) && <option value={campaign.offerId}>Saved offer</option>}{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label>
          <fieldset><legend className={labelClass}>Campaign routing</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="border-2 border-[#121212] bg-white p-3 text-sm"><input type="radio" name="trackingMode" value="redirect" defaultChecked={campaign?.trackingMode !== "direct"} className="mr-2 accent-[#1040C0]" />Redirect through Trakio tracker</label><label className="border-2 border-[#121212] bg-white p-3 text-sm"><input type="radio" name="trackingMode" value="direct" defaultChecked={campaign?.trackingMode === "direct"} className="mr-2 accent-[#1040C0]" />Direct to offer URL</label></div><p className="mt-2 text-xs text-[#3e4855]">Redirect records clicks in Trakio. Direct sends traffic straight to the offer with configured traffic-source parameters.</p></fieldset>
          {!edit && !loadingLists && sources.length === 0 ? <p className="text-sm text-[#D02020]">Create an enabled traffic source before creating a campaign.</p> : null}
          {!edit && !loadingLists && offers.length === 0 ? <p className="text-sm text-[#D02020]">Create an offer before creating a campaign.</p> : null}
          <footer className="-mx-5 flex items-center justify-between border-t-2 border-[#121212] px-5 pt-5 sm:-mx-7 sm:px-7">
            {edit ? <button type="button" onClick={edit.onClose} disabled={submitting} className={cancelClass}>Cancel</button> : <Link href="/admin/campaigns" className={cancelClass}>Cancel</Link>}
            <button disabled={!canSave} type="submit" className="bg-[#1040C0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{submitting ? "Saving…" : "Save"}</button>
          </footer>
        </form>
      </div>
    </section>
  );
}
