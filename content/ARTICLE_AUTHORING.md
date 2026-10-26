# Trakio article files

Add each public article as `content/articles/<lowercase-slug>.md`. Use plain Markdown; raw HTML is not rendered. The filename becomes the URL at `https://trakio.org/articles/<slug>`.

Required frontmatter:

```yaml
---
title: A clear title for the reader
description: A concise summary used in search and article listings.
category: Attribution basics
author: Trakio team
publishedAt: '2026-10-26'
status: draft
---
```

Use `status: draft` while writing and change it to `published` only after editorial review. Drafts are excluded from the public article list, generated routes, and sitemap. Set `updatedAt: 'YYYY-MM-DD'` only when a published article receives a meaningful update; do not change the date just to make a page look fresh.

Keep articles focused on a real setup or troubleshooting question. Verify product behavior against the current app and docs. Do not invent features, limits, integrations, outcomes, or customer claims. Link to relevant Trakio documentation and cite reliable sources for claims that may change.

The article template renders the frontmatter title as the page's only H1. Do not repeat it in the Markdown body; start with the opening paragraph and use H2 headings for sections. For a table of contents, use an `On this page` H2 and link to section headings by their lowercase, hyphenated text; the page generates matching heading IDs.
