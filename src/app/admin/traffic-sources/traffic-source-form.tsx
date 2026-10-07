"use client";

import { FormEvent, useRef, useState } from "react";

type ParameterRow = { name: string; parameter: string; token: string; enabled: boolean };
const fieldClass = "block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm text-[#121212] outline-none transition focus:border-[#1040C0] focus:ring-2 focus:ring-[#1040C0]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]";
const labelClass = "text-xs font-semibold text-[#3e4855]";
const tokenTemplates = ["{externalid}", "{clickid}", "{payout}", "{payout.currency}", "{transaction.id}", "{useragent}", "{var1}", "{country}", "{city}", "{region}", "{offer.id}", "{campaign.id}", "{campaign.name}", "{traffic.source.id}", "{traffic.source.name}", "{event.type}", "{conversion.cost}", "{workspace.id}", "{postbacktime}"];

export default function TrafficSourceForm() {
  const [rows, setRows] = useState<ParameterRow[]>([
    { name: "", parameter: "", token: "", enabled: true },
    { name: "", parameter: "", token: "", enabled: true },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const postbackRef = useRef<HTMLInputElement>(null);

  function updateRow(index: number, changes: Partial<ParameterRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  }

  function insertToken(token: string) {
    const input = postbackRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
    input.focus();
    const cursor = start + token.length;
    input.setSelectionRange(cursor, cursor);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const parameters = rows.filter((row) => row.name.trim() || row.parameter.trim() || row.token.trim()).map((row, index) => ({
      name: row.name.trim() || `var${index + 1}`,
      parameter: row.parameter.trim(),
      token: row.token.trim(),
      enabled: row.enabled,
    }));
    const body = {
      name: String(form.get("name") ?? "").trim(),
      type: "trafficstars",
      enabled: true,
      configuration: {
        postbackUrl: String(form.get("postbackUrl") ?? "").trim(),
        externalId: { parameter: String(form.get("externalIdParameter") ?? "").trim(), token: String(form.get("externalIdToken") ?? "").trim(), enabled: true },
        parameters,
        costCurrency: "USD",
      },
    };
    try {
      const response = await fetch("/api/admin/traffic-sources", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Unable to create traffic source.");
      setDone(true);
      event.currentTarget.reset();
      setRows([{ name: "", parameter: "", token: "", enabled: true }, { name: "", parameter: "", token: "", enabled: true }]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create traffic source.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="space-y-7" noValidate>
    {error ? <div role="alert" className="border-2 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
    {done ? <div role="status" className="border-2 border-[#121212] bg-[#F0C020] px-4 py-3 text-sm text-[#121212]">Traffic source created and ready to attach to a campaign.</div> : null}
    <section><h2 className="text-lg font-semibold text-[#121212]">General</h2><label className={`${labelClass} mt-5 block`}>Name<input required name="name" maxLength={200} className={`${fieldClass} mt-2`} placeholder="Traffic source name" /></label></section>
    <section><div className="flex items-baseline justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#121212]">Parameters</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-[#121212]">Use one external ID and custom parameters to preserve values from the traffic source.</p></div><span className="text-xs text-[#121212]">{rows.length}/10 custom</span></div><div className="mt-4 overflow-x-auto border-2 border-[#121212]"><div className="min-w-[720px]"><div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] gap-2 bg-[#E0E0E0] px-3 py-2 text-xs font-semibold text-[#121212]"><span>Variable name</span><span>TS parameter</span><span>TS token</span><span>VLM token</span><span>State</span></div><div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] items-center gap-2 border-t-2 border-[#121212] px-3 py-3"><span className="text-sm font-medium text-[#121212]">External ID</span><input name="externalIdParameter" className={fieldClass} placeholder="Type parameter" /><input name="externalIdToken" className={fieldClass} placeholder="Type token" /><span className="font-mono text-xs text-[#1040C0]">{`{externalid}`}</span><span className="text-xs text-[#121212]">Enabled</span></div>{rows.map((row, index) => <div key={index} className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] items-center gap-2 border-t-2 border-[#121212] px-3 py-3"><input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} className={fieldClass} placeholder={`Variable ${index + 1}`} aria-label={`Variable name ${index + 1}`} /><input value={row.parameter} onChange={(event) => updateRow(index, { parameter: event.target.value })} className={fieldClass} placeholder="Type parameter" aria-label={`Traffic-source parameter ${index + 1}`} /><input value={row.token} onChange={(event) => updateRow(index, { token: event.target.value })} className={fieldClass} placeholder="Type token" aria-label={`Traffic-source token ${index + 1}`} /><span className="font-mono text-xs text-[#1040C0]">{`{var${index + 1}}`}</span><span className="flex items-center gap-2"><button type="button" role="switch" aria-checked={row.enabled} onClick={() => updateRow(index, { enabled: !row.enabled })} className={`relative h-5 w-9 rounded-full transition ${row.enabled ? "bg-[#1040C0]" : "bg-[#121212]"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${row.enabled ? "left-[18px]" : "left-0.5"}`} /></button>{index === rows.length - 1 ? <button type="button" aria-label={`Delete variable ${index + 1}`} onClick={() => setRows((current) => current.length > 2 ? current.slice(0, -1) : current)} className="text-[#1040C0] hover:text-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</button> : null}</span></div>)}</div></div><button type="button" disabled={rows.length >= 10} onClick={() => setRows((current) => [...current, { name: "", parameter: "", token: "", enabled: true }])} className="mt-3 text-sm font-semibold text-[#1040C0] hover:underline disabled:cursor-not-allowed disabled:opacity-50">+ Add parameter</button></section>
    <section><h2 className="text-lg font-semibold text-[#121212]">Passing conversion info to traffic source</h2><p className="mt-1 text-sm leading-5 text-[#121212]">S2S Postback is the conversion tracking method for this traffic source.</p><label className={`${labelClass} mt-4 block`}>Traffic source postback URL<input ref={postbackRef} required name="postbackUrl" type="url" className={`${fieldClass} mt-2`} placeholder="https://example.com/postback?clickid={clickid}" /></label><div className="mt-3 flex flex-wrap gap-2" aria-label="Postback token templates">{tokenTemplates.map((token) => <button key={token} type="button" onClick={() => insertToken(token)} className="border-2 border-[#121212] bg-[#E0E0E0] px-2 py-1 text-xs text-[#1040C0] hover:border-[#1040C0] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{token}</button>)}</div></section>
    <div className="flex justify-end border-t-2 border-[#121212] pt-5"><button disabled={submitting} type="submit" className="bg-[#1040C0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{submitting ? "Saving…" : "Save"}</button></div>
  </form>;
}
