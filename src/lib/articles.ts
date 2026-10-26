import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";
import MarkdownIt from "markdown-it";

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  status: "draft" | "published";
  content: string;
};

const articleDirectory = join(process.cwd(), "content", "articles");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

function requiredText(data: Record<string, unknown>, key: string, slug: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Article "${slug}" needs a non-empty ${key} field.`);
  }
  return value.trim();
}

function dateValue(value: unknown, key: string, slug: string): string {
  const dateString = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Article "${slug}" needs ${key} in YYYY-MM-DD format.`);
  }
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== dateString) {
    throw new Error(`Article "${slug}" has an invalid ${key} date.`);
  }
  return dateString;
}

function parseArticleFile(filename: string, source: string): Article {
  const slug = filename.replace(/\.md$/, "");
  if (!slugPattern.test(slug)) throw new Error(`Article filename "${filename}" must use a lowercase URL-safe slug.`);

  const parsed = matter(source);
  const data = parsed.data as Record<string, unknown>;
  const status = data.status;
  if (status !== "draft" && status !== "published") {
    throw new Error(`Article "${slug}" status must be "draft" or "published".`);
  }

  const article: Article = {
    slug,
    title: requiredText(data, "title", slug),
    description: requiredText(data, "description", slug),
    category: requiredText(data, "category", slug),
    author: requiredText(data, "author", slug),
    publishedAt: dateValue(data.publishedAt, "publishedAt", slug),
    status,
    content: parsed.content.trim(),
  };

  if (typeof data.updatedAt !== "undefined") article.updatedAt = dateValue(data.updatedAt, "updatedAt", slug);
  if (!article.content) throw new Error(`Article "${slug}" has no body content.`);
  if (article.description.length > 200) throw new Error(`Article "${slug}" description must be 200 characters or fewer.`);

  return article;
}

function readAllArticles(): Article[] {
  return readdirSync(articleDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => parseArticleFile(entry.name, readFileSync(join(articleDirectory, entry.name), "utf8")))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.title.localeCompare(right.title));
}

export function getAllArticles(): Article[] {
  return readAllArticles();
}

export function getPublishedArticles(): Article[] {
  return readAllArticles().filter((article) => article.status === "published");
}

export function getPublishedArticle(slug: string): Article | undefined {
  if (!slugPattern.test(slug)) return undefined;
  return getPublishedArticles().find((article) => article.slug === slug);
}

export function renderArticleMarkdown(content: string): string {
  return markdown.render(content);
}

export function articleDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function serializeArticle(slug: string, article: Omit<Article, "slug">): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.description)}`,
    `category: ${JSON.stringify(article.category)}`,
    `author: ${JSON.stringify(article.author)}`,
    `publishedAt: '${article.publishedAt}'`,
    ...(article.updatedAt ? [`updatedAt: '${article.updatedAt}'`] : []),
    `status: ${article.status}`,
    "---",
  ].join("\n");
  const source = `${frontmatter}\n\n${article.content.trim()}\n`;
  parseArticleFile(`${slug}.md`, source);
  return source;
}
