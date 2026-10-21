"use client";

import { useEffect, useState } from "react";

type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
type KeyResponse = { available: boolean; keys: ApiKey[]; scopes: string[] };

export default function ApiKeyManager() {
  const [data, setData] = useState<KeyResponse | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"read_only" | "full_access">("read_only");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/api-keys", { cache: "no-store" });
    const result = await response.json() as KeyResponse;
    setData(result);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/api-keys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load API keys.");
        return await response.json() as KeyResponse;
      })
      .then((result) => { if (active) setData(result); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load API keys."); });
    return () => { active = false; };
  }, []);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mode }),
      });
      const result = await response.json() as { token?: string; error?: { message?: string } };
      if (!response.ok || !result.token) throw new Error(result.error?.message ?? "Unable to create API key.");
      setToken(result.token);
      setName("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create API key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to revoke API key.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke API key.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setMessage("API key copied. Store it somewhere safe; it will not be shown again.");
  }

  return (
    <section className="mt-8 border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_#121212]" aria-labelledby="api-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#121212] pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D02020]">Developer access</p>
          <h2 id="api-heading" className="mt-2 text-2xl font-bold">Customer API</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6">Connect your own tools or AI agents to your Trakio workspace. Keys are shown once and can be revoked here.</p>
        </div>
        <a href="https://trakio.org/docs#customer-api" className="min-h-11 border-2 border-[#121212] px-3 py-2 text-sm font-bold shadow-[3px_3px_0_#121212] hover:bg-[#F0C020]">API docs</a>
      </div>

      {data?.available === false && <p className="mt-5 border-l-4 border-[#F0C020] bg-[#F0F0F0] p-4 text-sm">API access is included with Operator and Expanded plans. Existing keys are disabled while the account is on another plan; you can still revoke them below.</p>}
      {data?.available && <>
        {token && <div className="mt-5 border-2 border-[#1040C0] bg-[#F0F0F0] p-4" role="status">
            <p className="text-sm font-bold">Copy this key now. It will not be shown again.</p>
            <code className="mt-3 block break-all text-xs">{token}</code>
            <button type="button" onClick={() => void copyToken()} className="mt-3 min-h-11 border-2 border-[#121212] bg-white px-3 py-2 text-sm font-bold hover:bg-[#F0C020]">Copy key</button>
          </div>}
          <form onSubmit={createKey} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="text-sm font-semibold">Key name
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="My reporting agent" className="mt-1 block min-h-11 w-full border-2 border-[#121212] px-3" />
            </label>
            <label className="text-sm font-semibold">Access
              <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="mt-1 block min-h-11 w-full border-2 border-[#121212] bg-white px-3">
                <option value="read_only">Read only</option><option value="full_access">Read and write</option>
              </select>
            </label>
            <button disabled={busy} className="min-h-11 border-2 border-[#121212] bg-[#1040C0] px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_#121212] disabled:opacity-60">Create key</button>
          </form>
          {message && <p className="mt-3 text-sm" role="status">{message}</p>}
      </>}
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
      <div className="mt-6 divide-y-2 divide-[#E0E0E0] border-y-2 border-[#121212]">
        {data?.keys.filter((key) => !key.revokedAt).map((key) => (
          <div key={key.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div><p className="font-bold">{key.name}</p><p className="mt-1 font-mono text-xs">{key.prefix}… · {key.scopes.some((scope) => scope.endsWith(":write")) ? "Read and write" : "Read only"}</p><p className="mt-1 text-xs text-[#444]">{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}` : "Not used yet"}</p></div>
            <button type="button" disabled={busy} onClick={() => void revoke(key.id)} className="min-h-11 border-2 border-[#121212] px-3 py-2 text-sm font-bold hover:bg-[#D02020] hover:text-white disabled:opacity-60">Revoke</button>
          </div>
        ))}
        {data && data.keys.every((key) => key.revokedAt) && <p className="py-4 text-sm">No active API keys.</p>}
      </div>
    </section>
  );
}
