"use client";

import { Fragment, useState } from "react";

type Visit = {
  clickId: string;
  clickedAt: Date;
  trackingTokens: unknown;
  capturedLabel: string;
};

const preferredTokenOrder = [
  "ref",
  "cost",
  "format",
  "source",
  "campaign_id",
  "ad_id",
  "adspot_id",
  "site_id",
  "zone_id",
  "creative_id",
];

function tokenEntries(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>)
    .map(([key, token]) => [key, typeof token === "string" ? token : String(token)] as [string, string])
    .sort(([left], [right]) => {
      const leftPriority = preferredTokenOrder.indexOf(left);
      const rightPriority = preferredTokenOrder.indexOf(right);
      return (leftPriority < 0 ? Number.MAX_SAFE_INTEGER : leftPriority) - (rightPriority < 0 ? Number.MAX_SAFE_INTEGER : rightPriority);
    });
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default function VisitsTable({ visits }: { visits: Visit[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggle(clickId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(clickId)) next.delete(clickId);
      else next.add(clickId);
      return next;
    });
  }

  if (visits.length === 0) {
    return <p className="mt-4 border-2 border-[#121212] bg-[#FFFFFF] px-4 py-6 text-sm">No visits match this date range.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto border-2 border-[#121212] bg-[#FFFFFF]">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-[#E0E0E0] text-[11px] uppercase tracking-[0.1em] text-[#121212]">
          <tr>
            <th scope="col" className="w-[19%] px-4 py-3">Visit ID</th>
            <th scope="col" className="w-[25%] px-4 py-3">Captured</th>
            <th scope="col" className="px-4 py-3">Key parameters</th>
            <th scope="col" className="w-24 px-4 py-3 text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => {
            const entries = tokenEntries(visit.trackingTokens);
            const keyEntries = entries.slice(0, 3);
            const isExpanded = expanded.has(visit.clickId);
            const panelId = `visit-${visit.clickId.replace(/[^a-zA-Z0-9_-]/g, "-")}-details`;

            return (
              <Fragment key={visit.clickId}>
                <tr key={`${visit.clickId}-summary`} className="border-t border-[#121212] align-middle">
                  <td className="px-4 py-3 font-mono text-xs" title={visit.clickId}>{shortId(visit.clickId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{visit.capturedLabel}</td>
                  <td className="px-4 py-3">
                    {keyEntries.length ? (
                      <div className="flex flex-wrap gap-2">
                        {keyEntries.map(([key, value]) => (
                          <span key={key} className="max-w-full break-all border border-[#121212] bg-[#F0F0F0] px-2 py-1 font-mono text-[11px] leading-4">
                            <strong>{key}=</strong>{value}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-[#555555]">No captured parameters</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entries.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => toggle(visit.clickId)}
                        className="whitespace-nowrap border border-[#121212] px-2 py-1 text-xs font-semibold hover:bg-[#F0F0F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1744C8]"
                      >
                        {isExpanded ? "Hide" : entries.length > keyEntries.length ? `+ ${entries.length - keyEntries.length} more` : "View all"}
                      </button>
                    ) : <span className="text-xs text-[#555555]">—</span>}
                  </td>
                </tr>
                <tr key={`${visit.clickId}-details`} hidden={!isExpanded} className="border-t border-[#D0D0D0] bg-[#F7F7F7]">
                    <td id={panelId} colSpan={4} className="px-4 py-4">
                      {isExpanded ? <>
                      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]">All parameters ({entries.length})</h3>
                      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                        {entries.map(([key, value]) => (
                          <div key={key} className="grid min-w-0 grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-b border-[#D0D0D0] py-1.5 text-xs">
                            <dt className="break-words font-mono text-[#444444]">{key}</dt>
                            <dd className="min-w-0 break-all font-mono">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      </> : null}
                    </td>
                  </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
