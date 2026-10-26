import type { MetadataRoute } from "next";

import { articleDate, getPublishedArticles } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/about",
    "/features",
    "/pricing",
    "/docs",
    "/articles",
  ].map((path) => ({
    url: `https://trakio.org${path}`,
  }));

  const articles = getPublishedArticles().map((article) => ({
    url: `https://trakio.org/articles/${article.slug}`,
    lastModified: articleDate(article.updatedAt ?? article.publishedAt),
  }));

  return [...staticPages, ...articles];
}
