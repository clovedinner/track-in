import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicSiteShell } from "@/app/public-site-shell";
import { articleDate, getPublishedArticle, getPublishedArticles, renderArticleMarkdown } from "@/lib/articles";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedArticles().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedArticle(slug);
  if (!article) return {};

  const canonical = `https://trakio.org/articles/${article.slug}`;
  return {
    title: `${article.title} | Trakio`,
    description: article.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: article.title,
      description: article.description,
      publishedTime: articleDate(article.publishedAt).toISOString(),
      ...(article.updatedAt ? { modifiedTime: articleDate(article.updatedAt).toISOString() } : {}),
      authors: [article.author],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getPublishedArticle(slug);
  if (!article) notFound();

  return (
    <PublicSiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/articles" className="inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-[0.18em] text-[#D02020] hover:underline">← Back to articles</Link>
        <p className="mt-8 font-mono text-sm text-[#D02020]">{article.category}</p>
        <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">{article.title}</h1>
        <p className="public-lead mt-6">{article.description}</p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-y border-[#121212] py-3 text-xs text-[#454545]">
          <span>By {article.author}</span>
          <time dateTime={article.publishedAt}>Published {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(articleDate(article.publishedAt))}</time>
          {article.updatedAt ? <time dateTime={article.updatedAt}>Updated {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(articleDate(article.updatedAt))}</time> : null}
        </div>
        <div className="article-body mt-10" dangerouslySetInnerHTML={{ __html: renderArticleMarkdown(article.content) }} />
        <Link href="/docs" className="mt-10 inline-flex min-h-11 items-center border-2 border-[#121212] bg-[#1040C0] px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Read the setup docs</Link>
      </article>
    </PublicSiteShell>
  );
}
