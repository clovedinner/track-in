import { describe, expect, it } from "vitest";

import { canManuallyRetry } from "@/lib/admin/delivery-health";
import { OutboundPostbackStatus } from "@/generated/prisma/enums";

describe("manual delivery retry policy", () => {
  it("allows retryable and terminal failures", () => {
    expect(canManuallyRetry(OutboundPostbackStatus.retryable_failed)).toBe(true);
    expect(canManuallyRetry(OutboundPostbackStatus.permanently_failed)).toBe(true);
  });

  it("does not retry active, delivered, or suppressed jobs", () => {
    expect(canManuallyRetry(OutboundPostbackStatus.pending)).toBe(false);
    expect(canManuallyRetry(OutboundPostbackStatus.processing)).toBe(false);
    expect(canManuallyRetry(OutboundPostbackStatus.delivered)).toBe(false);
    expect(canManuallyRetry(OutboundPostbackStatus.suppressed)).toBe(false);
  });
});
