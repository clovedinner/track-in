#!/usr/bin/env node

/**
 * Safe provider checklist. By default this only validates JSON and prints a
 * redacted request shape. It never performs a network request.
 *
 * Input: PROVIDER_VERIFY_CONFIG='[{"providerId":"trafficstars","configuration":{...},"sampleTokens":{...}}]'
 * Live mode is intentionally guarded twice and is not used by normal checks:
 *   node scripts/verify-providers.mjs --live --confirm-live
 *   TRACK_IN_ALLOW_LIVE_PROVIDER_CHECK=1
 */

const input = process.env.PROVIDER_VERIFY_CONFIG;
const live = process.argv.includes("--live");
const confirmed = process.argv.includes("--confirm-live");

if (!input) {
  console.error("Set PROVIDER_VERIFY_CONFIG to a JSON array before running the provider checklist.");
  process.exitCode = 1;
} else {
  let entries;
  try {
    entries = JSON.parse(input);
  } catch {
    console.error("PROVIDER_VERIFY_CONFIG must be valid JSON.");
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    if (!Array.isArray(entries) || entries.length === 0) {
      console.error("PROVIDER_VERIFY_CONFIG must be a non-empty JSON array.");
      process.exitCode = 1;
    } else {
      const allowed = new Set(["trafficstars", "propeller", "trafficjunky"]);
      const plans = entries.map((entry) => {
        if (!entry || typeof entry !== "object") throw new Error("Each provider entry must be an object.");
        const provider = String(entry.providerId ?? "").trim().toLowerCase();
        if (!allowed.has(provider)) throw new Error(`Unsupported provider: ${provider || "empty"}.`);
        const config = entry.configuration;
        const rawUrl = config?.postbackUrl ?? config?.endpoint;
        const url = new URL(rawUrl);
        if (!/^https?:$/.test(url.protocol)) throw new Error(`${provider} postback URL must use HTTP or HTTPS.`);
        const tokens = entry.sampleTokens && typeof entry.sampleTokens === "object" ? entry.sampleTokens : {};
        const tokenKeys = provider === "trafficstars" ? ["clickid", "click_id", "CLICKID"] : provider === "propeller" ? ["subid", "SUBID", "clickid", "CLICKID", "click_id", "CLICK_ID"] : ["ACLID", "aclid", "clickid", "click_id"];
        const hasToken = tokenKeys.some((key) => typeof tokens[key] === "string" && tokens[key].trim().length > 0);
        if (!hasToken) throw new Error(`${provider} is missing a sample original click token.`);
        for (const key of url.searchParams.keys()) url.searchParams.set(key, "[redacted]");
        return { provider, method: "GET", rawUrl: url.toString(), redactedUrl: url.toString(), externalCall: false };
      });
      if (live && (!confirmed || process.env.TRACK_IN_ALLOW_LIVE_PROVIDER_CHECK !== "1")) {
        console.error("Live checks require --live, --confirm-live, and TRACK_IN_ALLOW_LIVE_PROVIDER_CHECK=1. No request was sent.");
        process.exitCode = 1;
      } else {
        if (live) {
          const results = await Promise.all(plans.map(async (plan) => {
            try {
              const response = await fetch(plan.rawUrl, { method: plan.method, headers: { accept: "*/*" } });
              return { provider: plan.provider, status: response.status, ok: response.ok };
            } catch (error) {
              return { provider: plan.provider, status: 0, ok: false, error: error instanceof Error ? error.message.slice(0, 120) : "request failed" };
            }
          }));
          console.log(JSON.stringify({ mode: "live-guarded", providers: results }, null, 2));
        } else {
          console.log(JSON.stringify({
            mode: "dry-run",
            providers: plans.map(({ provider, method, redactedUrl, externalCall }) => ({ provider, method, redactedUrl, externalCall })),
          }, null, 2));
        }
      }
    }
  }
}
