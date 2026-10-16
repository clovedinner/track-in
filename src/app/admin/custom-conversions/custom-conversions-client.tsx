"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type CustomConversion = {
  id: string;
  name: string;
  eventValues: string[];
  includeInConversions: boolean;
  includeInRevenue: boolean;
  sendPostbackToTrafficSource: boolean;
  includeInCost: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: { message?: string } };
const fieldClass = "mt-2 block w-full border-2 border-[#121212] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1040C0] focus:ring-2 focus:ring-[#1040C0]/20";
const labelClass = "block text-xs font-semibold text-[#3e4855]";

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as ApiError;
  return body.error?.message ?? fallback;
}

export default function CustomConversionsClient() {
  const [items, setItems] = useState<CustomConversion[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomConversion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/custom-conversions", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(await readApiError(response, "Custom conversions could not be loaded."));
      const body = await response.json() as { customConversions?: CustomConversion[]; limit?: number };
      setItems(body.customConversions ?? []);
      if (typeof body.limit === "number") setLimit(body.limit);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Custom conversions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/custom-conversions", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response, "Custom conversions could not be loaded."));
        return await response.json() as { customConversions?: CustomConversion[]; limit?: number };
      })
      .then((body) => {
        if (!active) return;
        setItems(body.customConversions ?? []);
        if (typeof body.limit === "number") setLimit(body.limit);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Custom conversions could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setDialogOpen(false);
        setEditing(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialogOpen, saving]);

  function openCreate() {
    setEditing(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: CustomConversion) {
    setEditing(item);
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      eventValues: form.get("eventValues"),
      includeInConversions: form.has("includeInConversions"),
      includeInRevenue: form.has("includeInRevenue"),
      sendPostbackToTrafficSource: form.has("sendPostbackToTrafficSource"),
      includeInCost: form.has("includeInCost"),
    };
    try {
      const response = await fetch(editing ? `/api/admin/custom-conversions/${editing.id}` : "/api/admin/custom-conversions", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to save custom conversion."));
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save custom conversion.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: CustomConversion) {
    if (!window.confirm(`Delete “${item.name}”?`)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/custom-conversions/${item.id}`, { method: "DELETE", headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to delete custom conversion."));
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete custom conversion.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <header className="flex flex-col gap-5 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D02020]">Trakio / configuration</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Custom conversions</h1><p className="mt-3 max-w-2xl text-sm leading-6">Name the conversion events your site sends, then map those events to postbacks in a traffic source.</p></div>
      <button type="button" onClick={openCreate} disabled={items.length >= limit || loading} className="self-start border-2 border-[#121212] bg-[#1040C0] px-5 py-3 text-sm font-semibold text-white shadow-[3px_3px_0_#121212] hover:bg-[#1239a2] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">Add custom conversion <span aria-hidden="true">+</span></button>
    </header>

    <section className="mt-8 border-2 border-[#121212] bg-white" aria-labelledby="conversion-list-title">
      <div className="flex flex-col gap-3 border-b-2 border-[#121212] bg-[#E0E0E0] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="conversion-list-title" className="text-lg font-semibold">Event definitions</h2><p className="mt-1 text-xs text-[#3e4855]">Accepted values are matched against the incoming event type (`et`).</p></div><p className="text-xs font-semibold uppercase tracking-[0.1em]">{items.length} of {limit} used</p></div>
      {error ? <div role="alert" className="border-b-2 border-[#D02020] bg-white px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
      {loading ? <p className="px-5 py-8 text-sm">Loading your custom conversions…</p> : items.length === 0 ? <div className="px-5 py-9"><h3 className="text-lg font-semibold">No custom conversions yet.</h3><p className="mt-2 max-w-xl text-sm leading-6 text-[#3e4855]">Create an event such as Registration or Deposit and enter the `et` values your site will send. You can then map it to a traffic-source postback.</p><button type="button" onClick={openCreate} className="mt-5 border-2 border-[#121212] bg-[#1040C0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1239a2]">Create first event</button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left text-sm"><caption className="sr-only">Custom conversion definitions for this account</caption><thead className="bg-[#121212] text-xs uppercase tracking-[0.1em] text-white"><tr><th className="w-16 px-4 py-3 font-semibold">#</th><th className="px-4 py-3 font-semibold">Event name</th><th className="px-4 py-3 font-semibold">Accepted et values</th><th className="px-4 py-3 font-semibold">Reporting</th><th className="w-36 px-4 py-3 font-semibold">Actions</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id} className="border-t-2 border-[#121212] bg-white hover:bg-[#FFF5CC]"><td className="px-4 py-4 font-mono text-xs">{index + 1}</td><td className="px-4 py-4 font-semibold">{item.name}</td><td className="max-w-[420px] px-4 py-4"><div className="flex flex-wrap gap-1.5">{item.eventValues.map((value) => <code key={value} className="border border-[#121212] bg-[#E0E0E0] px-1.5 py-0.5 text-xs">{value}</code>)}</div></td><td className="px-4 py-4 text-xs text-[#3e4855]">{[item.includeInConversions && "Conversions", item.includeInRevenue && "Revenue", item.sendPostbackToTrafficSource && "Traffic-source postback", item.includeInCost && "Cost"].filter(Boolean).join(" · ") || "Not included"}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><button type="button" onClick={() => openEdit(item)} className="font-semibold text-[#1040C0] underline underline-offset-2 hover:text-[#D02020]">Edit</button><button type="button" onClick={() => void remove(item)} disabled={saving} className="font-semibold text-[#D02020] underline underline-offset-2 disabled:opacity-50">Delete</button></div></td></tr>)}</tbody></table></div>}
      {!loading && items.length >= limit ? <p className="border-t-2 border-[#121212] bg-[#F0C020] px-4 py-3 text-xs">You have reached the {limit}-event limit. Delete an unused event before adding another.</p> : null}
    </section>

    {dialogOpen ? <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#121212]/45 p-3 sm:p-8" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}><section role="dialog" aria-modal="true" aria-labelledby="custom-conversion-dialog-title" className="my-4 w-full max-w-[640px] border-2 border-[#121212] bg-white shadow-[6px_6px_0_#121212] sm:my-10">
      <header className="flex items-center justify-between border-b-2 border-[#121212] px-5 py-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#D02020]">Event setup</p><h2 id="custom-conversion-dialog-title" className="mt-1 text-xl font-semibold sm:text-2xl">{editing ? "Edit custom conversion" : "New custom conversion"}</h2></div><button type="button" onClick={closeDialog} aria-label="Close dialog" className="border-2 border-[#121212] px-2 text-xl leading-7 hover:bg-[#F0C020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</button></header>
      <form onSubmit={submit} className="space-y-5 px-5 py-6" noValidate>
        <p className="border-l-4 border-[#1040C0] bg-[#E0E0E0] px-4 py-3 text-sm leading-6">If your postback sends <code className="font-semibold">et=signup</code> or <code className="font-semibold">et=registration</code>, add both values below to classify either as this event.</p>
        <label className={labelClass}>Custom conversion event name<input required name="name" maxLength={100} defaultValue={editing?.name ?? ""} className={fieldClass} placeholder="Registration" autoFocus /></label>
        <label className={labelClass}>Accepted values for the <code>et</code> parameter<textarea required name="eventValues" rows={4} maxLength={2500} defaultValue={editing?.eventValues.join("\n") ?? ""} className={`${fieldClass} resize-y`} placeholder={`reg\nregistration`} aria-describedby="event-values-help" /><span id="event-values-help" className="mt-1 block font-normal leading-5 text-[#3e4855]">One value per line. Values are normalized to lowercase and must be unique across your custom conversions.</span></label>
        <fieldset className="space-y-3 border-t-2 border-[#121212] pt-4"><legend className="px-1 text-sm font-semibold">Where this event is used</legend>
          <label className="flex items-start gap-3 text-sm"><input name="includeInConversions" type="checkbox" defaultChecked={editing?.includeInConversions ?? true} className="mt-0.5 h-4 w-4 accent-[#1040C0]" /><span><span className="font-semibold">Include in conversion counts</span><span className="mt-0.5 block text-xs text-[#3e4855]">Show this event in the conversion metrics and tables.</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input name="includeInRevenue" type="checkbox" defaultChecked={editing?.includeInRevenue ?? false} className="mt-0.5 h-4 w-4 accent-[#1040C0]" /><span><span className="font-semibold">Include in revenue</span><span className="mt-0.5 block text-xs text-[#3e4855]">Count this event’s reported value as revenue.</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input name="sendPostbackToTrafficSource" type="checkbox" defaultChecked={editing?.sendPostbackToTrafficSource ?? false} className="mt-0.5 h-4 w-4 accent-[#1040C0]" /><span><span className="font-semibold">Send postback to traffic source</span><span className="mt-0.5 block text-xs text-[#3e4855]">Make this event available for per-event postback configuration.</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input name="includeInCost" type="checkbox" defaultChecked={editing?.includeInCost ?? false} className="mt-0.5 h-4 w-4 accent-[#1040C0]" /><span><span className="font-semibold">Include in cost</span><span className="mt-0.5 block text-xs text-[#3e4855]">Reserve this event for cost reporting when configured.</span></span></label>
        </fieldset>
        {error ? <p role="alert" className="border-2 border-[#D02020] bg-white px-3 py-2 text-sm text-[#D02020]">{error}</p> : null}
        <footer className="-mx-5 flex items-center justify-between border-t-2 border-[#121212] px-5 pt-4"><button type="button" onClick={closeDialog} className="px-4 py-2 text-sm font-semibold text-[#1040C0] hover:bg-[#E0E0E0]">Cancel</button><button type="submit" disabled={saving} className="border-2 border-[#121212] bg-[#1040C0] px-6 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_#121212] hover:bg-[#1239a2] disabled:cursor-wait disabled:opacity-50">{saving ? "Saving…" : "Save event"}</button></footer>
      </form>
    </section></div> : null}
  </>;
}
