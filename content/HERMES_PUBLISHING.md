# Hermes article publishing API

Hermes can manage public Trakio articles through the internal API without GitHub or VPS credentials. The API accepts only article files and commits them to the configured repository. A commit to `main` starts the existing production deployment workflow.

## Server configuration

Set these variables in the production environment, then restart the web app:

```dotenv
HERMES_ARTICLE_API_KEY=<random secret of at least 32 characters>
GITHUB_ARTICLE_TOKEN=<fine-grained GitHub token>
GITHUB_ARTICLE_REPOSITORY=<owner/repository>
GITHUB_ARTICLE_BRANCH=main
```

Generate the Hermes API key with `openssl rand -hex 32`. Create a fine-grained GitHub token limited to this repository with **Contents: Read and write** permission. Keep both secrets on the server; give Hermes only the `HERMES_ARTICLE_API_KEY` value. Never send either secret in a prompt or commit it to Git.

## API

Base URL: `https://app.trakio.org/api/internal/articles`

Every request requires:

```http
Authorization: Bearer <HERMES_ARTICLE_API_KEY>
Content-Type: application/json
```

- `GET /api/internal/articles` lists article metadata and Markdown, including drafts.
- `POST /api/internal/articles` creates a new article. It returns `409` if the slug already exists.
- `PUT /api/internal/articles` updates an existing article by slug.

Example request body:

```json
{
  "slug": "preserving-click-ids-through-checkout",
  "title": "How to preserve click IDs through checkout",
  "description": "A practical guide to carrying a tracker click ID through a money-site checkout.",
  "category": "Attribution basics",
  "author": "Trakio team",
  "publishedAt": "2026-10-26",
  "status": "published",
  "content": "## Keep the click ID\n\nSave the `cid` received from the tracking link and send it with the conversion."
}
```

Use `status: "draft"` to save privately. Use `status: "published"` when Hermes should publish. A successful write returns a commit SHA and `deployment: "queued"`; the public page appears after GitHub Actions finishes deploying. A published article URL is `https://trakio.org/articles/<slug>`.

The API validates article frontmatter and body, caps requests at 100 KB, and only allows URL-safe slugs under `content/articles/`. It has no delete operation and cannot modify app code. Keep Hermes' prompt explicit: research current queries, avoid duplicating existing articles, verify product claims against current docs, and only use published status when ready to publish.

## Hermes connection

Configure an HTTP/API tool with the base URL above, the bearer token in a secret store, and JSON request bodies. Hermes should call `GET` before planning, create drafts with `POST`, revise them with `PUT`, then set `status` to `published` with another `PUT` to publish.
