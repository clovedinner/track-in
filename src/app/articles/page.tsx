import type { Metadata } from "next";
import Link from "next/link";

import { PublicSiteShell } from "@/app/public-site-shell";
import { articleDate, getPublishedArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Articles | Trakio",
  description: "Practical guidance on click tracking and conversion attribution.",
  alternates: { canonical: "https://trakio.org/articles" },
};

export default function ArticlesPage() {
  const articles = getPublishedArticles();

  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020]">Articles</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">Tracking that follows the whole journey.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7">Notes on connecting paid traffic to the events that matter on your site.</p>
        {articles.length ? (
          <div className="mt-12">
            {articles.map((article) => (
              <article key={article.slug} className="grid gap-5 border-t-2 border-[#121212] py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <p className="font-mono text-[#D02020]">{article.category}</p>
                    <time dateTime={article.publishedAt} className="text-[#454545]">
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(articleDate(article.publishedAt))}
                    </time>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    <Link href={`/articles/${article.slug}`} className="underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:decoration-current">
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6">{article.description}</p>
                </div>
                <Link href={`/articles/${article.slug}`} aria-label={`Read ${article.title}`} className="inline-flex min-h-11 items-center justify-center border-2 border-[#121212] bg-white px-4 py-3 text-sm font-bold shadow-[3px_3px_0_#121212] hover:bg-[#F0C020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">
                  Read article
                </Link>
              </article>
            ))}
            <div className="border-t-2 border-[#121212]" />
          </div>
        ) : (
          <p className="mt-12 border-y-2 border-[#121212] py-7 text-sm">New articles are in the works.</p>
        )}
      </div>
    </PublicSiteShell>
  );
}
