import { OutboundPostbackStatus } from "@/generated/prisma/enums";

export const deliveryHealthStatuses = [
  OutboundPostbackStatus.pending,
  OutboundPostbackStatus.processing,
  OutboundPostbackStatus.retryable_failed,
  OutboundPostbackStatus.delivered,
  OutboundPostbackStatus.permanently_failed,
] as const;

export type DeliveryHealthStatus = (typeof deliveryHealthStatuses)[number];

export function parseDeliveryHealthStatus(value: string | null): DeliveryHealthStatus | undefined {
  if (value === null || !deliveryHealthStatuses.includes(value as DeliveryHealthStatus)) {
    return undefined;
  }
  return value as DeliveryHealthStatus;
}

export function parseDeliveryHealthLimit(value: string | null): number {
  if (value === null || value.trim() === "") return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }
  return parsed;
}

export function sanitizeDiagnostic(value: string | null): string | null {
  if (value === null) return null;
  return value
    .replace(/authorization\s*[:=]\s*[^,]+/gi, "authorization=[redacted]")
    .replace(/(token|secret|api[-_]?key|password)\s*[:=]\s*[^,]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

export function destinationHost(destination: string): string | null {
  try {
    return new URL(destination).host;
  } catch {
    return null;
  }
}

export function canManuallyRetry(status: OutboundPostbackStatus): boolean {
  return status === OutboundPostbackStatus.retryable_failed || status === OutboundPostbackStatus.permanently_failed;
}
