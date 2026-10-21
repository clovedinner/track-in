import type { Metadata } from "next";
import Link from "next/link";

import PublicSiteNav from "@/app/public-site-nav";

export const metadata: Metadata = {
  title: "Articles | Trakio",
  description: "Practical guidance on click tracking and conversion attribution.",
};

export default function ArticlesPage() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <PublicSiteNav />
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020]">Articles</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">Tracking that follows the whole journey.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7">Notes on connecting paid traffic to the events that matter on your site.</p>
        <article className="mt-12 grid gap-6 border-y-2 border-[#121212] py-7 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-mono text-sm text-[#D02020]">Attribution basics</p>
            <h2 className="mt-2 text-2xl font-bold">Why the click ID matters</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6">A conversion can be matched to an ad visit only when the original click ID survives the journey from the tracking link to the money site and back.</p>
          </div>
          <Link href="/articles/why-the-click-id-matters" className="inline-flex min-h-11 items-center border-2 border-[#121212] bg-white px-4 py-3 text-sm font-bold shadow-[3px_3px_0_#121212] hover:bg-[#F0C020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Read article</Link>
        </article>
      </div>
    </main>
  );
}
