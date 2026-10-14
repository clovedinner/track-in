"use client";

import { useState } from "react";

export default function CopyableSnippet({ value, title = "Custom HTML for GTM", buttonLabel = "Copy script" }: { value: string; title?: string; buttonLabel?: string }) {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 border-2 border-[#121212] bg-[#FFFFFF]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#121212] bg-[#E0E0E0] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em]">{title}</p>
        <button type="button" onClick={copySnippet} className="min-h-11 border-2 border-[#121212] bg-[#1040C0] px-4 py-2 text-xs font-bold text-[#FFFFFF] shadow-[3px_3px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">
          {copied ? "Copied" : buttonLabel}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-[#121212]"><code>{value}</code></pre>
    </div>
  );
}
