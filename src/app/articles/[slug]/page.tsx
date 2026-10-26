import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleBody from "@/app/articles/article-body";
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
      <article className="article-page">
        <header className="article-header">
          <Link href="/articles" className="article-back">← Back to articles</Link>
          <p className="article-category">{article.category}</p>
          <h1 className="article-title">{article.title}</h1>
          <p className="article-deck">{article.description}</p>
          <div className="article-meta" aria-label="Article details">
            <span>By {article.author}</span>
            <time dateTime={article.publishedAt}>Published {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(articleDate(article.publishedAt))}</time>
            {article.updatedAt && article.updatedAt !== article.publishedAt ? <time dateTime={article.updatedAt}>Updated {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(articleDate(article.updatedAt))}</time> : null}
          </div>
        </header>
        <ArticleBody html={renderArticleMarkdown(article.content)} />
        <footer className="article-next-step">
          <div>
            <p className="article-next-label">Continue with Trakio</p>
            <h2>Put the tracking basics into practice.</h2>
          </div>
          <Link href="/docs" className="article-next-link">Read the setup docs</Link>
        </footer>
      </article>
    </PublicSiteShell>
  );
}
