import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getAllArticles, serializeArticle, type Article } from "@/lib/articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100_000;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function response(body: unknown, status = 200, requestId = randomUUID()) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function authorize(request: Request): "ok" | "unconfigured" | "unauthorized" {
  const expected = process.env.HERMES_ARTICLE_API_KEY;
  if (!expected || expected.length < 32) return "unconfigured";
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]{32,512})$/.exec(authorization);
  if (!match) return "unauthorized";
  const expectedHash = createHash("sha256").update(expected).digest();
  const receivedHash = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expectedHash, receivedHash) ? "ok" : "unauthorized";
}

function requireAuth(request: Request): NextResponse | null {
  const result = authorize(request);
  if (result === "unconfigured") return response({ error: "Article publishing API is not configured." }, 503);
  if (result === "unauthorized") return response({ error: "A valid bearer token is required." }, 401);
  return null;
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  if (!request.body) throw new Error("invalid_json");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

function articleFromBody(value: unknown): { slug: string; article: Omit<Article, "slug"> } | null {
  if (!isRecord(value)) return null;
  const { slug, title, description, category, author, publishedAt, updatedAt, status, content } = value;
  if (typeof slug !== "string" || !slugPattern.test(slug)) return null;
  if ([title, description, category, author, publishedAt, content].some((field) => typeof field !== "string")) return null;
  if (typeof updatedAt !== "undefined" && typeof updatedAt !== "string") return null;
  if (status !== "draft" && status !== "published") return null;

  return {
    slug,
    article: {
      title: title as string,
      description: description as string,
      category: category as string,
      author: author as string,
      publishedAt: publishedAt as string,
      ...(typeof updatedAt === "string" ? { updatedAt } : {}),
      status,
      content: content as string,
    },
  };
}

function githubConfiguration(): { repository: string; branch: string; token: string } | null {
  const token = process.env.GITHUB_ARTICLE_TOKEN;
  const repository = process.env.GITHUB_ARTICLE_REPOSITORY;
  const branch = process.env.GITHUB_ARTICLE_BRANCH ?? "main";
  if (!token || !repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return null;
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.includes("..")) return null;
  return { repository, branch, token };
}

async function githubRequest(path: string, method: "GET" | "PUT", token: string, body?: unknown): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method,
    cache: "no-store",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function GET(request: Request) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const articles = getAllArticles();
  return response({ articles });
}

async function saveArticle(request: Request, update: boolean) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const config = githubConfiguration();
  if (!config) return response({ error: "GitHub article publishing is not configured." }, 503);

  let input: unknown;
  try {
    input = await readJson(request);
  } catch (error) {
    return response({ error: error instanceof Error && error.message === "body_too_large" ? "Request body exceeds 100 KB." : "Request body must be valid JSON." }, error instanceof Error && error.message === "body_too_large" ? 413 : 400);
  }

  const parsed = articleFromBody(input);
  if (!parsed) return response({ error: "Provide a valid slug and article fields, including status draft or published." }, 400);

  let content: string;
  try {
    content = serializeArticle(parsed.slug, parsed.article);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Invalid article." }, 400);
  }

  const filePath = `content/articles/${parsed.slug}.md`;
  const endpoint = `/repos/${config.repository}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}`;
  try {
    let sha: string | undefined;
    if (update) {
      const existing = await githubRequest(`${endpoint}?ref=${encodeURIComponent(config.branch)}`, "GET", config.token);
      if (existing.status === 404) return response({ error: "Article not found." }, 404);
      if (!existing.ok) return response({ error: "GitHub could not read the existing article." }, 502);
      const existingPayload: unknown = await existing.json();
      if (!isRecord(existingPayload) || typeof existingPayload.sha !== "string") {
        return response({ error: "GitHub returned an invalid article record." }, 502);
      }
      sha = existingPayload.sha;
    }

    const result = await githubRequest(endpoint, "PUT", config.token, {
      message: `${update ? "Update" : "Add"} article: ${parsed.slug}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    });
    if (result.status === 409 || result.status === 422) {
      return response({ error: update ? "GitHub rejected the article update." : "An article with this slug already exists." }, update ? 502 : 409);
    }
    if (!result.ok) return response({ error: "GitHub could not save the article." }, 502);
    const payload: unknown = await result.json();
    const commit = isRecord(payload) && isRecord(payload.commit) && typeof payload.commit.sha === "string" ? payload.commit.sha : null;
    return response({ status: "saved", slug: parsed.slug, articleStatus: parsed.article.status, commit, deployment: "queued" }, update ? 200 : 201);
  } catch {
    return response({ error: "Unable to reach GitHub to save the article." }, 502);
  }
}

export async function POST(request: Request) {
  return saveArticle(request, false);
}

export async function PUT(request: Request) {
  return saveArticle(request, true);
}
