"use client";

import type { KeyboardEvent } from "react";

export default function ArticleBody({ html }: { html: string }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const tableRegion = event.target.closest<HTMLElement>(".article-table-scroll");
    if (!tableRegion || tableRegion.scrollWidth <= tableRegion.clientWidth) return;

    const pageStep = Math.max(64, tableRegion.clientWidth - 48);
    switch (event.key) {
      case "ArrowRight":
        tableRegion.scrollBy({ left: 64 });
        break;
      case "ArrowLeft":
        tableRegion.scrollBy({ left: -64 });
        break;
      case "PageDown":
        tableRegion.scrollBy({ left: pageStep });
        break;
      case "PageUp":
        tableRegion.scrollBy({ left: -pageStep });
        break;
      case "Home":
        tableRegion.scrollTo({ left: 0 });
        break;
      case "End":
        tableRegion.scrollTo({ left: tableRegion.scrollWidth });
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return <div className="article-body" onKeyDown={handleKeyDown} dangerouslySetInnerHTML={{ __html: html }} />;
}
