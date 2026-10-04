import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import {
  deliveryHealthStatuses,
  destinationHost,
  parseDeliveryHealthLimit,
  parseDeliveryHealthStatus,
  sanitizeDiagnostic,
} from "@/lib/admin/delivery-health";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const status = parseDeliveryHealthStatus(requestedStatus);

  if (requestedStatus !== null && status === undefined) {
    return apiErrorResponse(new ApiError("invalid_request", 400, "Invalid delivery status."), correlationId);
  }

  let limit: number;
  try {
    limit = parseDeliveryHealthLimit(url.searchParams.get("limit"));
  } catch (error) {
    return apiErrorResponse(new ApiError("invalid_request", 400, error instanceof Error ? error.message : "Invalid limit."), correlationId);
  }

  try {
    const [counts, postbacks] = await Promise.all([
      Promise.all(
        deliveryHealthStatuses.map(async (currentStatus) => [
          currentStatus,
          await prisma.outboundPostback.count({ where: { status: currentStatus } }),
        ] as const),
      ),
      prisma.outboundPostback.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          destination: true,
          status: true,
          attemptCount: true,
          nextAttemptAt: true,
          lastResponseStatus: true,
          lastResponseSummary: true,
          lastError: true,
          deliveredAt: true,
          createdAt: true,
          updatedAt: true,
          conversion: {
            select: {
              id: true,
              eventId: true,
              eventType: true,
              valueMinor: true,
              currency: true,
              click: { select: { clickId: true, campaign: { select: { slug: true, name: true } } } },
            },
          },
          trafficSource: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    const statusCounts = Object.fromEntries(counts);
    return NextResponse.json(
      {
        status: status ?? "all",
        counts: statusCounts,
        postbacks: postbacks.map((postback) => ({
          id: postback.id,
          destination_host: destinationHost(postback.destination),
          status: postback.status,
          attempt_count: postback.attemptCount,
          next_attempt_at: postback.nextAttemptAt,
          last_response_status: postback.lastResponseStatus,
          last_response_summary: sanitizeDiagnostic(postback.lastResponseSummary),
          last_error: sanitizeDiagnostic(postback.lastError),
          delivered_at: postback.deliveredAt,
          created_at: postback.createdAt,
          updated_at: postback.updatedAt,
          conversion: {
            id: postback.conversion.id,
            event_id: postback.conversion.eventId,
            event_type: postback.conversion.eventType,
            value_minor: postback.conversion.valueMinor.toString(),
            currency: postback.conversion.currency,
            click_id: postback.conversion.click.clickId,
            campaign: postback.conversion.click.campaign,
          },
          traffic_source: postback.trafficSource,
        })),
      },
      { headers: { "x-request-id": correlationId } },
    );
  } catch (error) {
    logger.error("admin.delivery_health_list_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      requestId: correlationId,
    });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to load delivery health."), correlationId);
  }
}
