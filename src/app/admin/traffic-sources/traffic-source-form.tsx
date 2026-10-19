"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { GENERIC_POSTBACK_TOKENS } from "@/lib/providers/generic";

type ParameterRow = { name: string; parameter: string; token: string; enabled: boolean };
type EventPostback = { customConversionId: string; url: string };
type CustomConversion = { id: string; name: string; eventValues: string[]; includeInConversions: boolean; includeInRevenue: boolean; sendPostbackToTrafficSource: boolean };
const fieldClass = "block w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm text-[#121212] outline-none transition focus:border-[#1040C0] focus:ring-2 focus:ring-[#1040C0]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]";
const labelClass = "text-xs font-semibold text-[#3e4855]";
const legacyTokenTemplates = ["{externalid}", "{clickid}", "{payout}", "{payout.currency}", "{transaction.id}", "{useragent}", "{var1}", "{country}", "{city}", "{region}", "{offer.id}", "{campaign.id}", "{campaign.name}", "{traffic.source.id}", "{traffic.source.name}", "{event.type}", "{conversion.cost}", "{workspace.id}", "{postbacktime}"];

export type TrafficSourceFormSource = { id: string; name: string; type: string; enabled: boolean; configuration?: Record<string, unknown> };
type TrafficSourceFormProps = { onCreated?: () => void; source?: TrafficSourceFormSource; duplicate?: boolean };

export default function TrafficSourceForm({ onCreated, source, duplicate = false }: TrafficSourceFormProps) {
  const sourceConfiguration = source?.configuration ?? {};
  const genericPostback = !source || duplicate || source.type === "generic";
  const tokenTemplates = genericPostback ? GENERIC_POSTBACK_TOKENS : legacyTokenTemplates;
  const sourceParameters = Array.isArray(sourceConfiguration.parameters) ? sourceConfiguration.parameters as Array<Record<string, unknown>> : [];
  const savedRows = sourceParameters.map((parameter) => ({ name: typeof parameter.name === "string" ? parameter.name : "", parameter: typeof parameter.parameter === "string" ? parameter.parameter : "", token: typeof parameter.token === "string" ? parameter.token : "", enabled: parameter.enabled !== false })).slice(0, 10);
  const savedPostbacks = Array.isArray(sourceConfiguration.eventPostbacks) ? sourceConfiguration.eventPostbacks.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry)).map((entry) => ({ customConversionId: typeof entry.customConversionId === "string" ? entry.customConversionId : "", url: typeof entry.url === "string" ? entry.url : "" })).slice(0, 10) : [];
  const [rows, setRows] = useState<ParameterRow[]>([
    ...savedRows,
    ...Array.from({ length: Math.max(0, 2 - savedRows.length) }, () => ({ name: "", parameter: "", token: "", enabled: true })),
  ].slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postbackMode, setPostbackMode] = useState<"single" | "per_event">(sourceConfiguration.postbackMode === "per_event" ? "per_event" : "single");
  const [eventPostbacks, setEventPostbacks] = useState<EventPostback[]>(savedPostbacks);
  const [customConversions, setCustomConversions] = useState<CustomConversion[]>([]);
  const [conversionLoadError, setConversionLoadError] = useState<string | null>(null);
  const postbackRef = useRef<HTMLInputElement>(null);
  const eventUrlRefs = useRef<Array<HTMLInputElement | null>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!source || !formRef.current) return;
    const configuration = source.configuration ?? {};
    const externalId = configuration.externalId && typeof configuration.externalId === "object" && !Array.isArray(configuration.externalId) ? configuration.externalId as Record<string, unknown> : {};
    const cost = configuration.cost && typeof configuration.cost === "object" && !Array.isArray(configuration.cost) ? configuration.cost as Record<string, unknown> : {};
    const parameter = formRef.current.elements.namedItem("externalIdParameter") as HTMLInputElement | null;
    const token = formRef.current.elements.namedItem("externalIdToken") as HTMLInputElement | null;
    const costParameter = formRef.current.elements.namedItem("costParameter") as HTMLInputElement | null;
    const costToken = formRef.current.elements.namedItem("costToken") as HTMLInputElement | null;
    const postback = formRef.current.elements.namedItem("postbackUrl") as HTMLInputElement | null;
    if (parameter) parameter.value = typeof externalId.parameter === "string" ? externalId.parameter : "";
    if (token) token.value = typeof externalId.token === "string" ? externalId.token : "";
    if (costParameter) costParameter.value = typeof cost.parameter === "string" ? cost.parameter : "cost";
    if (costToken) costToken.value = typeof cost.token === "string" ? cost.token : "{cost}";
    if (postback) postback.value = typeof configuration.postbackUrl === "string" ? configuration.postbackUrl : typeof configuration.endpoint === "string" ? configuration.endpoint : "";
  }, [source]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/custom-conversions", { headers: { accept: "application/json" } })
      .then(async (response) => {
        const result = await response.json() as { customConversions?: CustomConversion[]; error?: { message?: string } };
        if (!response.ok) throw new Error(result.error?.message ?? "Unable to load custom conversions.");
        return result.customConversions ?? [];
      })
      .then((values) => { if (active) setCustomConversions(values); })
      .catch((loadError: unknown) => { if (active) setConversionLoadError(loadError instanceof Error ? loadError.message : "Unable to load custom conversions."); });
    return () => { active = false; };
  }, []);

  function updateRow(index: number, changes: Partial<ParameterRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  }

  function insertToken(token: string, rowIndex?: number) {
    const input = rowIndex === undefined ? postbackRef.current : eventUrlRefs.current[rowIndex];
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
    if (rowIndex === undefined) input.value = nextValue;
    else setEventPostbacks((current) => current.map((row, index) => index === rowIndex ? { ...row, url: nextValue } : row));
    input.focus();
    const cursor = start + token.length;
    requestAnimationFrame(() => input.setSelectionRange(cursor, cursor));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const parameters = rows.filter((row) => row.name.trim() || row.parameter.trim() || row.token.trim()).map((row, index) => ({
      name: row.name.trim() || `var${index + 1}`,
      parameter: row.parameter.trim(),
      token: row.token.trim(),
      enabled: row.enabled,
    }));
    const postbackUrl = String(form.get("postbackUrl") ?? "").trim();
    const externalIdToken = String(form.get("externalIdToken") ?? "").trim();
    const providerType = source && !duplicate ? source.type : "generic";
    if (postbackMode === "single" && !isHttpUrl(postbackUrl)) {
      setError("Enter a valid HTTP or HTTPS postback URL.");
      setSubmitting(false);
      return;
    }
    const sendableConversions = customConversions.filter((conversion) => conversion.sendPostbackToTrafficSource);
    const selectedEventPostbacks = eventPostbacks.map((row) => ({ customConversionId: row.customConversionId, url: row.url.trim() }));
    if (postbackMode === "per_event") {
      if (conversionLoadError) {
        setError("Custom conversions could not be loaded. Refresh the page and try again.");
        setSubmitting(false);
        return;
      }
      if (selectedEventPostbacks.length === 0 || selectedEventPostbacks.some((row) => !sendableConversions.some((conversion) => conversion.id === row.customConversionId) || !isHttpUrl(row.url))) {
        setError("Choose a custom conversion and enter a valid HTTP or HTTPS URL for every event.");
        setSubmitting(false);
        return;
      }
    }
    const body = {
      name: String(form.get("name") ?? "").trim(),
      type: providerType,
      enabled: source?.enabled ?? true,
      configuration: {
        postbackMode,
        ...(postbackMode === "single" ? { postbackUrl } : { eventPostbacks: selectedEventPostbacks }),
        externalId: { parameter: String(form.get("externalIdParameter") ?? "").trim(), token: externalIdToken, enabled: true },
        cost: { parameter: String(form.get("costParameter") ?? "cost").trim() || "cost", token: String(form.get("costToken") ?? "{cost}").trim() || "{cost}", enabled: true },
        parameters,
        costCurrency: "USD",
      },
    };
    try {
      const response = await fetch(source && !duplicate ? `/api/admin/traffic-sources/${source.id}` : "/api/admin/traffic-sources", { method: source && !duplicate ? "PUT" : "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ ...body, name: duplicate ? `${body.name} copy` : body.name }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Unable to create traffic source.");
      setDone(true);
      formElement.reset();
      setRows([{ name: "", parameter: "", token: "", enabled: true }, { name: "", parameter: "", token: "", enabled: true }]);
      setEventPostbacks([]);
      onCreated?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create traffic source.");
    } finally {
      setSubmitting(false);
    }
  }

  function isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && value.length <= 2_048;
    } catch {
      return false;
    }
  }

  return <form ref={formRef} onSubmit={submit} className="space-y-7" noValidate>
    {error ? <div role="alert" className="border-2 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm text-[#D02020]">{error}</div> : null}
    {done ? <div role="status" className="border-2 border-[#121212] bg-[#F0C020] px-4 py-3 text-sm text-[#121212]">Traffic source created and ready to attach to a campaign.</div> : null}
    <section><h2 className="text-lg font-semibold text-[#121212]">General</h2><label className={`${labelClass} mt-5 block`}>Name<input required name="name" maxLength={200} defaultValue={source?.name ?? ""} className={`${fieldClass} mt-2`} placeholder="Traffic source name" /></label></section>
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#121212]">Parameters</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#121212]">Use one external ID and custom parameters to preserve values from the traffic source.</p>
        </div>
        <span className="text-xs text-[#121212]">{rows.length}/10 custom</span>
      </div>
      <div className="mt-4 overflow-x-auto border-2 border-[#121212]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] gap-2 bg-[#E0E0E0] px-3 py-2 text-xs font-semibold text-[#121212]">
            <span>Variable name</span><span>TS parameter</span><span>TS token</span><span>Trakio token</span><span>State</span>
          </div>
          <div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] items-center gap-2 border-t-2 border-[#121212] px-3 py-3">
            <span className="text-sm font-medium text-[#121212]">External ID</span>
            <input name="externalIdParameter" className={fieldClass} placeholder="Type parameter" />
            <input name="externalIdToken" className={fieldClass} placeholder="Type token" />
            <span className="font-mono text-xs text-[#1040C0]">{`{externalid}`}</span>
            <span className="text-xs text-[#121212]">Enabled</span>
          </div>
          <div className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] items-center gap-2 border-t-2 border-[#121212] px-3 py-3">
            <span className="text-sm font-medium text-[#121212]">Cost</span>
            <input name="costParameter" defaultValue="cost" className={fieldClass} aria-label="Cost traffic-source parameter" />
            <input name="costToken" defaultValue="{cost}" className={fieldClass} aria-label="Cost traffic-source token" />
            <span className="font-mono text-xs text-[#1040C0]">{`{cost}`}</span>
            <span className="text-xs text-[#121212]">Built-in</span>
          </div>
          {rows.map((row, index) => <div key={index} className="grid grid-cols-[1.1fr_1.1fr_1.1fr_0.7fr_72px] items-center gap-2 border-t-2 border-[#121212] px-3 py-3">
            <input value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} className={fieldClass} placeholder={`Variable ${index + 1}`} aria-label={`Variable name ${index + 1}`} />
            <input value={row.parameter} onChange={(event) => updateRow(index, { parameter: event.target.value })} className={fieldClass} placeholder="Type parameter" aria-label={`Traffic-source parameter ${index + 1}`} />
            <input value={row.token} onChange={(event) => updateRow(index, { token: event.target.value })} className={fieldClass} placeholder="Type token" aria-label={`Traffic-source token ${index + 1}`} />
            <span className="font-mono text-xs text-[#1040C0]">{`{var${index + 1}}`}</span>
            <span className="flex items-center gap-2">
              <button type="button" role="switch" aria-checked={row.enabled} onClick={() => updateRow(index, { enabled: !row.enabled })} className={`relative h-5 w-9 rounded-full transition ${row.enabled ? "bg-[#1040C0]" : "bg-[#121212]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${row.enabled ? "left-[18px]" : "left-0.5"}`} />
              </button>
              {index === rows.length - 1 ? <button type="button" aria-label={`Delete variable ${index + 1}`} onClick={() => setRows((current) => current.length > 2 ? current.slice(0, -1) : current)} className="text-[#1040C0] hover:text-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</button> : null}
            </span>
          </div>)}
        </div>
      </div>
      <button type="button" disabled={rows.length >= 10} onClick={() => setRows((current) => [...current, { name: "", parameter: "", token: "", enabled: true }])} className="mt-3 text-sm font-semibold text-[#1040C0] hover:underline disabled:cursor-not-allowed disabled:opacity-50">+ Add parameter</button>
    </section>
    <section>
      <h2 className="text-lg font-semibold text-[#121212]">Passing conversion info to traffic source</h2>
      <p className="mt-1 text-sm leading-5 text-[#121212]">Choose one postback URL for every conversion, or map custom conversion events to separate URLs.</p>
      {genericPostback ? <p className="mt-2 text-sm leading-5 text-[#3e4855]">Use {"{externalid}"} for the captured External ID, not Trakio’s visit ID. Use {"{var1}"}–{"{var10}"} for custom parameters. Trakio replaces these placeholders and sends your URL without adding platform-specific fields.</p> : null}
      <fieldset className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-2 border-[#121212] bg-[#F0F0F0] p-4">
        <legend className="px-1 text-xs font-semibold text-[#3e4855]">Postback delivery</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#121212]"><input type="radio" name="postbackMode" value="single" checked={postbackMode === "single"} onChange={() => setPostbackMode("single")} className="accent-[#1040C0]" />One postback URL</label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#121212]"><input type="radio" name="postbackMode" value="per_event" checked={postbackMode === "per_event"} onChange={() => setPostbackMode("per_event")} className="accent-[#1040C0]" />Postback URL per event</label>
      </fieldset>
      {postbackMode === "single" ? <div className="mt-4">
        <label className={`${labelClass} block`}>Traffic source postback URL<input ref={postbackRef} name="postbackUrl" type="url" className={`${fieldClass} mt-2`} placeholder="https://example.com/postback?clickid={externalid}" /></label>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Postback token templates">{tokenTemplates.map((token) => <button key={token} type="button" onClick={() => insertToken(token)} className="border-2 border-[#121212] bg-[#E0E0E0] px-2 py-1 text-xs text-[#1040C0] hover:border-[#1040C0] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{token}</button>)}</div>
      </div> : <div className="mt-4 space-y-4">
        {conversionLoadError ? <div role="alert" className="border-2 border-[#D02020] bg-[#F0F0F0] px-3 py-2 text-sm text-[#D02020]">{conversionLoadError}</div> : null}
        {customConversions.filter((conversion) => conversion.sendPostbackToTrafficSource).length === 0 && !conversionLoadError ? <p className="border-2 border-[#121212] bg-[#F0C020] px-3 py-2 text-sm">Create a custom conversion and enable “Send postback to traffic source” before adding event postbacks.</p> : null}
        {eventPostbacks.map((row, index) => <div key={`${index}-${row.customConversionId}`} className="border-2 border-[#121212] bg-white p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.5fr)_auto] sm:items-end">
            <label className={`${labelClass} block`}>Conversion event<select value={row.customConversionId} onChange={(event) => setEventPostbacks((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, customConversionId: event.target.value } : item))} className={`${fieldClass} mt-2`}><option value="">Select an event</option>{customConversions.filter((conversion) => conversion.sendPostbackToTrafficSource).map((conversion) => <option key={conversion.id} value={conversion.id}>{conversion.name}</option>)}</select></label>
            <label className={`${labelClass} block`}>Custom postback URL<input ref={(element) => { eventUrlRefs.current[index] = element; }} value={row.url} onChange={(event) => setEventPostbacks((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, url: event.target.value } : item))} type="url" className={`${fieldClass} mt-2`} placeholder="https://example.com/postback?clickid={externalid}" aria-label={`Postback URL for event ${index + 1}`} /></label>
            <button type="button" disabled={eventPostbacks.length <= 1} onClick={() => setEventPostbacks((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Remove event postback ${index + 1}`} className="h-10 border-2 border-[#121212] px-3 text-lg font-semibold text-[#D02020] hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-40">×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label={`Postback token templates for event ${index + 1}`}>{tokenTemplates.map((token) => <button key={token} type="button" onClick={() => insertToken(token, index)} className="border-2 border-[#121212] bg-[#E0E0E0] px-2 py-1 text-xs text-[#1040C0] hover:border-[#1040C0] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{token}</button>)}</div>
        </div>)}
        <button type="button" disabled={eventPostbacks.length >= 10 || customConversions.filter((conversion) => conversion.sendPostbackToTrafficSource).length === 0} onClick={() => setEventPostbacks((current) => [...current, { customConversionId: "", url: "" }])} className="border-2 border-[#121212] bg-[#F0C020] px-4 py-2 text-sm font-semibold text-[#121212] hover:bg-[#E0B020] disabled:cursor-not-allowed disabled:opacity-50">+ Add event <span className="ml-2 text-xs">{eventPostbacks.length}/10</span></button>
      </div>}
    </section>
    <div className="flex justify-end border-t-2 border-[#121212] pt-5"><button disabled={submitting} type="submit" className="bg-[#1040C0] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1040C0] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{submitting ? "Saving…" : "Save"}</button></div>
  </form>;
}
