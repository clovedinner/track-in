import { OutboundPostbackStatus } from "@/generated/prisma/enums";

const defaultStaleProcessingMinutes = 10;

export type AlertSeverity = "warning" | "critical";
export type AlertKind =
  | "outbound_postback_permanently_failed"
  | "outbound_postback_retryable_overdue"
  | "outbound_postback_stuck_processing";

export type TrackingAlert = {
  kind: AlertKind;
  severity: AlertSeverity;
  count: number;
  message: string;
};

type AlertDatabase = Pick<Awaited<typeof import("@/lib/database/prisma")>["prisma"], "outboundPostback">;

type AlertQueryOptions = {
  now?: Date;
  staleProcessingMinutes?: number;
};

/**
 * Reads only persisted conditions that need operator attention. This is
 * intentionally provider-neutral: a cron job, webhook adapter, or email
 * adapter can consume the result without coupling the domain to a vendor.
 */
export async function getActionableAlerts(
  database: AlertDatabase | undefined = undefined,
  options: AlertQueryOptions = {},
): Promise<TrackingAlert[]> {
  const databaseClient = database ?? (await import("@/lib/database/prisma")).prisma;
  const now = options.now ?? new Date();
  const staleProcessingMinutes = options.staleProcessingMinutes ?? defaultStaleProcessingMinutes;
  const staleProcessingBefore = new Date(now.getTime() - staleProcessingMinutes * 60_000);

  const [permanentlyFailed, retryableOverdue, stuckProcessing] = await Promise.all([
    databaseClient.outboundPostback.count({ where: { status: OutboundPostbackStatus.permanently_failed } }),
    databaseClient.outboundPostback.count({
      where: {
        status: OutboundPostbackStatus.retryable_failed,
        nextAttemptAt: { lte: now },
      },
    }),
    databaseClient.outboundPostback.count({
      where: {
        status: OutboundPostbackStatus.processing,
        lockedAt: { lte: staleProcessingBefore },
      },
    }),
  ]);

  const alerts: TrackingAlert[] = [];
  if (permanentlyFailed > 0) {
    alerts.push({
      kind: "outbound_postback_permanently_failed",
      severity: "critical",
      count: permanentlyFailed,
      message: `${permanentlyFailed} outbound postback${permanentlyFailed === 1 ? " is" : "s are"} permanently failed.`,
    });
  }
  if (retryableOverdue > 0) {
    alerts.push({
      kind: "outbound_postback_retryable_overdue",
      severity: "warning",
      count: retryableOverdue,
      message: `${retryableOverdue} outbound postback${retryableOverdue === 1 ? " is" : "s are"} overdue for retry.`,
    });
  }
  if (stuckProcessing > 0) {
    alerts.push({
      kind: "outbound_postback_stuck_processing",
      severity: "critical",
      count: stuckProcessing,
      message: `${stuckProcessing} outbound postback${stuckProcessing === 1 ? " is" : "s are"} stuck in processing.`,
    });
  }

  return alerts;
}

export function formatAlertNotification(alerts: readonly TrackingAlert[]): string | null {
  if (alerts.length === 0) return null;
  return alerts.map((alert) => `[${alert.severity.toUpperCase()}] ${alert.message}`).join("\n");
}

export function hasCriticalAlerts(alerts: readonly TrackingAlert[]): boolean {
  return alerts.some((alert) => alert.severity === "critical");
}
