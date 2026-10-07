"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Offer = { id: string; name: string; offerUrl: string | null; visits: number; conversions: number; errors: number; registrations: number; ftd: number };

const field = "mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm text-[#121212] outline-none transition focus:border-[#1040C0] focus:ring-2 focus:ring-[#1040C0]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]";
const label = "text-xs font-semibold text-[#3e4855]";
const tokenTemplates = ["{clickid}", "{campaign.id}", "{externalid}", "{var1}", "{traffic.source.id}", "{offer.id}", "{flow.id}"];

export default function OffersClient() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const response = await fetch("/api/admin/offers", { headers: { accept: "application/json" } });
      const body = await response.json() as { offers?: Offer[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Offers could not be loaded.");
      setOffers(body.offers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Offers could not be loaded.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/offers", { headers: { accept: "application/json" } }).then(async (response) => {
      const body = await response.json() as { offers?: Offer[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Offers could not be loaded.");
      if (!cancelled) setOffers(body.offers ?? []);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Offers could not be loaded.");
    });
    return () => { cancelled = true; };
  }, []);

  function insertToken(token: string) {
    const input = urlRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
    input.value = nextValue;
    input.focus();
    const cursor = start + token.length;
    input.setSelectionRange(cursor, cursor);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/offers", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ name: form.get("name"), offerUrl: form.get("offerUrl") }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to create offer.");
      event.currentTarget.reset();
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create offer.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="mt-6 flex justify-end"><button type="button" onClick={() => { setError(null); setOpen(true); }} className="bg-[#1040C0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">New offer +</button></div>
    {error ? <div role="alert" className="mt-8 border-2 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
    {open ? <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#121212]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="new-offer-title"><div className="my-4 w-full max-w-[760px] border-2 border-[#121212] bg-white shadow-2xl sm:my-10"><header className="flex items-center justify-between border-b-2 border-[#121212] px-5 py-4 sm:px-7"><h2 id="new-offer-title" className="text-xl font-semibold text-[#121212] sm:text-2xl">New offer</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close new offer" className="text-2xl leading-none text-[#1040C0] hover:text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</button></header><div className="border-b-2 border-[#121212] px-5 sm:px-7"><div className="border-b-2 border-[#1040C0] py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#1040C0]">General</div></div><form onSubmit={submit} className="space-y-6 px-5 py-7 sm:px-7" noValidate><div><h3 className="text-lg font-semibold text-[#121212]">General</h3><p className="mt-1 text-sm text-[#121212]">This offer reports conversions through S2S Postback.</p></div><label className={label}>Name<input required name="name" maxLength={200} className={field} placeholder="Offer name" autoFocus /></label><div><label className={label}>Offer URL<input ref={urlRef} required name="offerUrl" type="url" className={field} placeholder="https://example.com/offer?cid={clickid}" /></label><p className="mt-2 border-2 border-[#121212] bg-[#E0E0E0] px-3 py-2.5 text-xs leading-5 text-[#3e4855]">Add the <strong>{`{clickid}`}</strong> token to pass the tracker click ID to the offer. Click a token below to insert it at the cursor.</p><div className="mt-3 flex flex-wrap gap-2" aria-label="Offer URL token templates">{tokenTemplates.map((token) => <button key={token} type="button" onClick={() => insertToken(token)} className="border-2 border-[#121212] bg-[#E0E0E0] px-2 py-1 text-xs text-[#1040C0] hover:border-[#1040C0] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{token}</button>)}</div></div><footer className="-mx-5 flex items-center justify-between border-t-2 border-[#121212] px-5 pt-5 sm:-mx-7 sm:px-7"><button type="button" onClick={() => setOpen(false)} className="border-2 border-transparent px-4 py-2.5 text-sm font-semibold text-[#1040C0] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Cancel</button><button disabled={saving} type="submit" className="bg-[#1040C0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{saving ? "Saving…" : "Save"}</button></footer></form></div></section> : null}
    <section className="mt-8 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]" aria-label="Offer performance"><table className="w-full min-w-[860px] border-collapse text-left text-sm"><caption className="sr-only">Offer performance</caption><thead className="bg-[#E0E0E0] text-xs uppercase tracking-[0.1em] text-[#121212]"><tr>{["Name", "Offer URL", "Visits", "Conversions", "Error", "Registration", "FTD"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{offers.map((offer) => <tr key={offer.id} className="border-t-2 border-[#121212] hover:bg-[#E0E0E0]"><td className="px-4 py-4 font-semibold">{offer.name}</td><td className="max-w-xs truncate px-4 py-4 text-xs text-[#121212]">{offer.offerUrl ?? "Not configured"}</td><td className="px-4 py-4 font-mono">{offer.visits.toLocaleString()}</td><td className="px-4 py-4 font-mono">{offer.conversions.toLocaleString()}</td><td className="px-4 py-4 font-mono">{offer.errors.toLocaleString()}</td><td className="px-4 py-4 font-mono">{offer.registrations.toLocaleString()}</td><td className="px-4 py-4 font-mono">{offer.ftd.toLocaleString()}</td></tr>)}</tbody></table>{offers.length === 0 ? <div className="border-t-2 border-[#121212] px-6 py-10"><h2 className="text-lg font-semibold">No offers yet.</h2><p className="mt-2 text-sm text-[#121212]">Create an offer to make it available in campaign setup.</p><button type="button" onClick={() => setOpen(true)} className="mt-4 bg-[#1040C0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0]">Create first offer</button></div> : null}</section>
  </>;
}
