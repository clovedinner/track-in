import type { Metadata } from "next";
import Link from "next/link";

import PublicSiteNav from "@/app/public-site-nav";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Documentation | Trakio",
  description: "Set up click tracking and send attributed conversion events to Trakio.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <PublicSiteNav />
      <div className="mx-auto grid min-w-0 max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:px-12">
        <aside className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020]">Documentation</p>
          <h1 className="mt-4 max-w-lg text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">From click to conversion.</h1>
          <p className="mt-6 max-w-lg text-base leading-7">Trakio connects a tracked campaign visit to a conversion reported by your money site.</p>
          <Link href={`${appUrl}/auth/sign-in`} className="mt-8 inline-flex min-h-11 items-center border-2 border-[#121212] bg-[#1040C0] px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Open the dashboard</Link>
        </aside>
        <div className="min-w-0 space-y-8">
          <section className="border-2 border-[#121212] bg-white p-5 sm:p-7">
            <p className="font-mono text-sm text-[#D02020]">01 / Campaign</p>
            <h2 className="mt-3 text-2xl font-bold">Create a tracking link</h2>
            <p className="mt-3 text-sm leading-6">In the dashboard, create a campaign, choose its destination, and select the traffic source. Copy the generated tracking URL into your ad platform. Trakio records the click and forwards the visitor with a unique <code className="font-mono">cid</code> parameter.</p>
          </section>
          <section className="border-2 border-[#121212] bg-white p-5 sm:p-7">
            <p className="font-mono text-sm text-[#D02020]">02 / Money site</p>
            <h2 className="mt-3 text-2xl font-bold">Keep the click ID</h2>
            <p className="mt-3 text-sm leading-6">Save <code className="font-mono">cid</code> when the visitor arrives and keep it with the registration or order. Trakio cannot attribute an event if the money site drops the click ID or sends an unknown one.</p>
          </section>
          <section className="border-2 border-[#121212] bg-white p-5 sm:p-7">
            <p className="font-mono text-sm text-[#D02020]">03 / Conversion</p>
            <h2 className="mt-3 text-2xl font-bold">Send the event from your server</h2>
            <p className="mt-3 text-sm leading-6">The preferred integration is an authenticated server-to-server request. Keep the bearer secret on your server, and use a stable event ID so retries do not create duplicate conversions.</p>
            <pre className="mt-4 max-w-full overflow-x-auto border-2 border-[#121212] bg-[#E0E0E0] p-4 text-xs leading-6"><code>{`POST https://app.trakio.org/api/conversions
Authorization: Bearer YOUR_CONVERSION_WEBHOOK_SECRET
Content-Type: application/json

{
  "cid": "click-id-from-the-landing-visit",
  "event_id": "order-1042-purchase",
  "event_type": "purchase",
  "occurred_at": "2026-10-21T10:30:00Z",
  "value_minor": 1299,
  "currency": "USD"
}`}</code></pre>
            <p className="mt-3 text-xs leading-5">For a Voluum-compatible GTM workflow, the public <code className="font-mono">/postback</code> endpoint accepts <code className="font-mono">cid</code>, <code className="font-mono">et</code>, and an optional unique <code className="font-mono">txid</code>. The money-site server integration is preferred when available.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
