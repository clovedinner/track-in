import SetupTestButton from "./setup-test-button";
import CopyableSnippet from "./copyable-snippet";
import { getRuntimeEnvironment } from "@/lib/config/environment";
import { buildCampaignSetupReport, type CampaignSetupInput } from "@/lib/setup/campaign-setup";
import { buildCampaignTrackingScript } from "@/lib/setup/campaign-tracking-script";

export default function CampaignSetupContent({ campaign }: { campaign: CampaignSetupInput }) {
  const environment = getRuntimeEnvironment();
  const report = buildCampaignSetupReport(campaign, environment.trackerUrl ?? environment.appUrl ?? "http://localhost:3000");
  const installScript = buildCampaignTrackingScript(report.trackerBaseUrl);
  const setupEnabled = process.env.TRACK_IN_ALLOW_TEST_SETUP === "1";
  return <div className="space-y-8 px-5 py-7 sm:px-8">
    <header className="border-b-2 border-[#121212] pb-6"><p className="font-mono text-sm">{report.campaign.slug}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">Campaign setup</h1><p className="mt-3 max-w-2xl text-sm leading-6">Install the campaign tracking script on the money site through GTM, then use the tracking URL and conversion tags below.</p></header>
    <section className="grid gap-px border-2 border-[#121212] bg-[#121212] sm:grid-cols-2 lg:grid-cols-3" aria-label="Setup checks">{Object.entries({ "Active campaign": report.checks.campaignActive, "HTTPS destination": report.checks.destinationHttps, "Provider configured": report.checks.providerConfigured, "Provider enabled": report.checks.providerEnabled, "Token allowlisted": report.checks.providerTokenAllowlisted, "External calls": !report.checks.externalCalls }).map(([label, pass]) => <div key={label} className="bg-white px-4 py-4"><p className="text-xs font-bold uppercase tracking-[0.1em]">{label}</p><p className={`mt-2 text-sm font-bold ${pass ? "text-[#121212]" : "text-[#D02020]"}`}>{pass ? "Ready" : "Needs attention"}</p></div>)}</section>
    {report.providerError ? <p className="border-2 border-[#D02020] bg-white px-4 py-3 text-sm text-[#D02020]">{report.providerError}</p> : null}
    {report.trackingMode === "direct" ? <section aria-labelledby="install-heading"><h2 id="install-heading" className="text-2xl font-black">Install campaign tracking script</h2><div className="mt-4 border-2 border-[#121212] bg-[#F0C020] px-4 py-4 text-sm leading-6"><p className="font-bold">Tracker domain</p><code className="mt-1 block break-all text-xs">{report.trackerBaseUrl}/g/.js</code></div><CopyableSnippet value={installScript} /></section> : null}
    <section aria-labelledby="tracking-url-heading"><h2 id="tracking-url-heading" className="text-xl font-bold">Tracking URL</h2><p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#D02020]">Mode: {report.trackingMode}</p><p className="mt-1 text-sm">Use this URL for the configured traffic source. Provider macros are preserved for expansion by the ad platform.</p>{Object.values(report.trackingUrls).map((url) => <CopyableSnippet key={url} value={url} title="Tracking URL" buttonLabel="Copy URL" />)}{Object.keys(report.trackingUrls).length === 0 ? <p className="mt-4 text-sm text-[#D02020]">Add a supported traffic source before generating a tracking URL.</p> : null}</section>
    <section aria-labelledby="postback-heading"><h2 id="postback-heading" className="text-xl font-bold">GTM conversion tags</h2><p className="mt-1 text-sm">These image URLs target the Voluum-compatible /postback endpoint and contain no credentials.</p>{report.trackingMode === "direct" ? <p className="mt-2 text-xs text-[#3e4855]">Keep the usual Page View flow: run the tracking script when the page URL contains <code>cpid=</code>. For conversion tags on pages such as <code>register-done</code>, use a GTM First-Party Cookie variable named <code>trackin_cid</code> for the postback <code>cid</code> value.</p> : null}{report.gtm.snippets.map((snippet) => <CopyableSnippet key={snippet.eventType} value={snippet.imageUrl} title={`${snippet.label} image URL`} buttonLabel="Copy URL" />)}</section>
    <SetupTestButton campaignId={campaign.id} enabled={setupEnabled} />
  </div>;
}
