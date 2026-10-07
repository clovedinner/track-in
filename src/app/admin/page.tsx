import type { Metadata } from "next";

import { getVerificationSnapshot } from "@/lib/admin/verification";
import { logger } from "@/lib/observability/logger";

export const metadata: Metadata = {
  title: "Verification | Track.in",
  description: "Private click and conversion verification.",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: Date) {
  return `${dateFormatter.format(value)} UTC`;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function tokenSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const entries = Object.entries(value);
  if (entries.length === 0) return "—";
  return entries.map(([key, token]) => `${key}=${String(token)}`).join(" · ");
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

async function loadSnapshot() {
  try {
    return await getVerificationSnapshot();
  } catch (error) {
    logger.error("admin.verification_snapshot_failed", {
      error: error instanceof Error ? error.message : "unknown",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

export default async function AdminVerificationPage() {
  const snapshot = await loadSnapshot();

  if (snapshot === null) {
    return (
      <main className="min-h-screen bg-[#f4f1ea] px-5 py-8 text-[#17202a] sm:px-8 lg:px-12 lg:py-12">
        <section className="mx-auto max-w-2xl border border-[#a34f2d] bg-[#fffaf5] px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f2d]">Verification unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold">The database snapshot could not be loaded.</h1>
          <p className="mt-3 text-sm leading-6 text-[#59636c]">
            Check the application database connection and try this page again. No tracking data was changed.
          </p>
        </section>
      </main>
    );
  }

  const hasActivity = snapshot.recentClicks.length > 0 || snapshot.recentConversions.length > 0;

  return (
      <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <header className="flex flex-col gap-6 border-b border-[#c8c3b8] pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f2d]">Track.in / private</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-[#17202a] sm:text-5xl">
                Verify the handoff.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#59636c]">
                A focused view of the records that prove an ad click became a conversion.
                This is operational evidence, not a reporting dashboard.
              </p>
            </div>
            <div className="text-left text-xs text-[#59636c] sm:text-right">
              <a className="font-semibold text-[#a34f2d] underline underline-offset-4" href="/admin/delivery-health">Delivery health</a>
              <p className="font-semibold uppercase tracking-[0.16em] text-[#17202a]">UTC</p>
              <p className="mt-1">Live database snapshot</p>
            </div>
          </header>

          <section aria-label="Verification totals" className="grid gap-px border-x border-b border-[#c8c3b8] bg-[#c8c3b8] sm:grid-cols-3">
            <Metric label="Clicks recorded" value={snapshot.clickCount.toLocaleString()} />
            <Metric label="Conversions accepted" value={snapshot.conversionCount.toLocaleString()} />
            <Metric label="Delivery work pending" value={snapshot.pendingDeliveryCount.toLocaleString()} tone={snapshot.pendingDeliveryCount > 0 ? "alert" : "normal"} />
          </section>

          {!hasActivity ? (
            <section className="mt-10 border border-dashed border-[#a9a398] bg-[#faf8f3] px-6 py-10">
              <h2 className="text-lg font-semibold">No tracking activity yet.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#59636c]">
                Send a test click through an active campaign, then complete a controlled money-site conversion.
                The resulting click and conversion will appear here.
              </p>
            </section>
          ) : (
            <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_1.15fr]">
              <ActivityTable
                title="Recent clicks"
                description="The tracker records these before redirecting the visitor."
                headers={["Campaign", "Click ID", "Captured", "Tokens"]}
              >
                {snapshot.recentClicks.map((click) => (
                  <tr key={click.clickId} className="border-t border-[#ded9cf] align-top">
                    <td className="px-3 py-4 font-medium text-[#17202a]">{click.campaign.name}</td>
                    <td className="px-3 py-4 font-mono text-xs text-[#59636c]">{shortId(click.clickId)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-[#59636c]">{formatDate(click.clickedAt)}</td>
                    <td className="max-w-48 px-3 py-4 text-xs leading-5 text-[#59636c]">{tokenSummary(click.trackingTokens)}</td>
                  </tr>
                ))}
              </ActivityTable>

              <ActivityTable
                title="Recent conversions"
                description="Each row should point back to one click and one delivery outcome."
                headers={["Event", "Campaign", "Value", "Received", "Delivery"]}
              >
                {snapshot.recentConversions.map((conversion) => (
                  <tr key={conversion.id} className="border-t border-[#ded9cf] align-top">
                    <td className="px-3 py-4">
                      <p className="font-medium text-[#17202a]">{conversion.eventType}</p>
                      <p className="mt-1 font-mono text-[11px] text-[#59636c]">{shortId(conversion.eventId)}</p>
                    </td>
                    <td className="px-3 py-4 text-sm text-[#17202a]">{conversion.click.campaign.name}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-[#17202a]">
                      {conversion.valueMinor.toString()} <span className="text-xs text-[#59636c]">{conversion.currency} minor</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-[#59636c]">{formatDate(conversion.receivedAt)}</td>
                    <td className="px-3 py-4 text-xs text-[#59636c]">
                      {conversion.outboundPostbacks.length === 0
                        ? "not queued"
                        : conversion.outboundPostbacks.map((postback) => statusLabel(postback.status)).join(", ")}
                    </td>
                  </tr>
                ))}
              </ActivityTable>
            </div>
          )}
        </div>
      </main>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "alert" }) {
  return (
    <div className="bg-[#faf8f3] px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#59636c]">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-[-0.04em] ${tone === "alert" ? "text-[#a34f2d]" : "text-[#17202a]"}`}>{value}</p>
    </div>
  );
}

function ActivityTable({
  title,
  description,
  headers,
  children,
}: {
  title: string;
  description: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 text-sm text-[#59636c]">{description}</p>
      </div>
      <div className="overflow-x-auto border border-[#c8c3b8] bg-[#faf8f3]">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="bg-[#e8e3d9] text-xs uppercase tracking-[0.1em] text-[#59636c]">
            <tr>{headers.map((header) => <th key={header} className="px-3 py-3 font-semibold">{header}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
