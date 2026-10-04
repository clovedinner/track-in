import { describe, expect, it, vi } from "vitest";

import { formatAlertNotification, getActionableAlerts, hasCriticalAlerts } from "@/lib/observability/alerts";

function databaseWithCounts(counts: { permanent: number; overdue: number; stuck: number }) {
  return {
    outboundPostback: {
      count: vi.fn().mockResolvedValueOnce(counts.permanent).mockResolvedValueOnce(counts.overdue).mockResolvedValueOnce(counts.stuck),
    },
  } as never;
}

describe("actionable tracking alerts", () => {
  it("classifies persisted delivery failures by severity", async () => {
    const alerts = await getActionableAlerts(databaseWithCounts({ permanent: 2, overdue: 1, stuck: 3 }), {
      now: new Date("2026-10-04T00:00:00.000Z"),
    });

    expect(alerts).toEqual([
      expect.objectContaining({ kind: "outbound_postback_permanently_failed", severity: "critical", count: 2 }),
      expect.objectContaining({ kind: "outbound_postback_retryable_overdue", severity: "warning", count: 1 }),
      expect.objectContaining({ kind: "outbound_postback_stuck_processing", severity: "critical", count: 3 }),
    ]);
    expect(hasCriticalAlerts(alerts)).toBe(true);
  });

  it("returns no notification when there is nothing actionable", async () => {
    const alerts = await getActionableAlerts(databaseWithCounts({ permanent: 0, overdue: 0, stuck: 0 }));
    expect(alerts).toEqual([]);
    expect(formatAlertNotification(alerts)).toBeNull();
  });

  it("formats a provider-neutral notification body", () => {
    const alerts = [
      { kind: "outbound_postback_retryable_overdue" as const, severity: "warning" as const, count: 1, message: "1 outbound postback is overdue for retry." },
      { kind: "outbound_postback_permanently_failed" as const, severity: "critical" as const, count: 2, message: "2 outbound postbacks are permanently failed." },
    ];
    expect(formatAlertNotification(alerts)).toBe("[WARNING] 1 outbound postback is overdue for retry.\n[CRITICAL] 2 outbound postbacks are permanently failed.");
  });
});
