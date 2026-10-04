import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { OutboundPostbackStatus } from "@/generated/prisma/enums";

import { canManuallyRetry } from "@/lib/admin/delivery-health";
import { parseTrafficSourceId } from "@/lib/admin/traffic-sources";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getRuntimeEnvironment } from "@/lib/config/environment";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const id = (await context.params).id;
  try {
    parseTrafficSourceId(id);
  } catch {
    return apiErrorResponse(new ApiError("invalid_request", 400, "id must be a valid UUID."), correlationId);
  }

  const now = new Date();
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.outboundPostback.findUnique({
        where: { id },
        select: { id: true, status: true, attemptCount: true },
      });
      if (current === null) throw new ApiError("not_found", 404, "Outbound postback not found.");
      if (!canManuallyRetry(current.status)) {
        throw new ApiError("conflict", 409, "Only failed outbound postbacks can be retried.");
      }

      const updated = await transaction.outboundPostback.updateMany({
        where: {
          id,
          status: { in: [OutboundPostbackStatus.retryable_failed, OutboundPostbackStatus.permanently_failed] },
        },
        data: {
          status: OutboundPostbackStatus.pending,
          nextAttemptAt: now,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw new ApiError("conflict", 409, "Outbound postback changed before retry.");

      await transaction.auditEntry.create({
        data: {
          action: "outbound_postback.manual_retry",
          entityType: "outbound_postback",
          entityId: id,
          actor: getRuntimeEnvironment().adminUsername ?? "admin",
          metadata: { previousStatus: current.status, attemptCount: current.attemptCount } as Prisma.InputJsonValue,
          correlationId,
        },
      });
      return { id };
    });

    logger.info("admin.outbound_postback_manual_retry", { postbackId: result.id, requestId: correlationId });
    return NextResponse.json({ status: "queued", postback_id: result.id }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, correlationId);
    logger.error("admin.outbound_postback_manual_retry_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      requestId: correlationId,
    });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to retry outbound postback."), correlationId);
  }
}
