import type { Metadata } from "next";
import Link from "next/link";

import PublicSiteNav from "@/app/public-site-nav";

export const metadata: Metadata = {
  title: "Why the click ID matters | Trakio",
  description: "How a click ID connects an ad visit to a later conversion without relying on guesswork.",
};

export default function ClickIdArticlePage() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <PublicSiteNav />
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/articles" className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020] hover:underline">← Articles</Link>
        <p className="mt-8 font-mono text-sm text-[#D02020]">Attribution basics</p>
        <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">Why the click ID matters</h1>
        <p className="mt-6 text-lg leading-8">A tracker can connect an ad visit to a later conversion when both events share a reliable identifier. In Trakio, that identifier is the click ID, or <code className="font-mono">cid</code>.</p>
        <div className="mt-10 space-y-6 text-base leading-7">
          <section>
            <h2 className="text-2xl font-bold">It starts at the tracking link</h2>
            <p className="mt-3">When a visitor opens a campaign tracking URL, Trakio records the click and creates an opaque ID. It redirects the visitor to the configured destination with that ID attached as <code className="font-mono">cid</code>.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold">The money site has to keep it</h2>
            <p className="mt-3">Your site should save the incoming <code className="font-mono">cid</code> alongside the visitor’s registration or order. When the event happens, send the same value to Trakio. Without it, Trakio cannot reliably determine which click produced the event.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold">Use a stable event ID too</h2>
            <p className="mt-3">A unique event ID lets Trakio recognize a retry as the same conversion. That keeps a network timeout or repeated postback from recording the same order twice.</p>
          </section>
        </div>
        <Link href="/docs" className="mt-10 inline-flex min-h-11 items-center border-2 border-[#121212] bg-[#1040C0] px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Read the setup docs</Link>
      </article>
    </main>
  );
}
