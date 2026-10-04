import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import {
  getPostbackDestination,
  hasValidBearerSecret,
  hashConversionPayload,
  MAX_CONVERSION_BODY_BYTES,
  MONEY_SITE_SOURCE,
  parseConversionPayload,
} from "@/lib/conversions/intake";
import { getRuntimeEnvironment } from "@/lib/config/environment";

const conversionSelect = { id: true } as const;

function response(body: Record<string, string>, status: number, correlationId: string): NextResponse {
  return NextResponse.json(body, { status, headers: { "x-request-id": correlationId } });
}

export async function POST(request: Request): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const environment = getRuntimeEnvironment();

  if (!hasValidBearerSecret(request.headers.get("authorization"), environment.conversionWebhookSecret)) {
    return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_CONVERSION_BODY_BYTES) {
    return apiErrorResponse(new ApiError("invalid_request", 400, "Request body is too large."), correlationId);
  }

  let rawPayload: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_CONVERSION_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    rawPayload = JSON.parse(rawBody);
  } catch {
    return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId);
  }

  let input;
  try {
    input = parseConversionPayload(rawPayload);
  } catch (error) {
    return apiErrorResponse(new ApiError("invalid_request", 400, error instanceof Error ? error.message : "Invalid request."), correlationId);
  }

  try {
    const existing = await prisma.conversion.findUnique({
      where: { source_eventId: { source: MONEY_SITE_SOURCE, eventId: input.event_id } },
      select: conversionSelect,
    });
    if (existing) {
      return response({ status: "duplicate", conversion_id: existing.id }, 200, correlationId);
    }

    const click = await prisma.click.findUnique({
      where: { clickId: input.cid },
      select: { id: true, trafficSourceId: true, trafficSource: { select: { id: true, enabled: true, configuration: true } } },
    });
    if (!click) {
      return apiErrorResponse(new ApiError("not_found", 404, "Unknown click ID."), correlationId);
    }

    const conversion = await prisma.$transaction(async (transaction) => {
      const created = await transaction.conversion.create({
        data: {
          clickRecordId: click.id,
          source: MONEY_SITE_SOURCE,
          eventId: input.event_id,
          eventType: input.event_type,
          occurredAt: input.occurred_at,
          valueMinor: input.value_minor,
          currency: input.currency,
          transactionReference: input.transaction_reference,
          payloadHash: hashConversionPayload(rawPayload),
          validationState: "accepted",
          correlationId,
        },
        select: { id: true },
      });

      const destination = click.trafficSource?.enabled
        ? getPostbackDestination(click.trafficSource.configuration)
        : undefined;
      if (click.trafficSourceId !== null && click.trafficSource?.enabled && destination !== undefined) {
        await transaction.outboundPostback.create({
          data: {
            conversionId: created.id,
            trafficSourceId: click.trafficSourceId,
            destination,
            correlationId,
          },
        });
      }

      return created;
    });

    logger.info("conversion.accepted", { correlationId, conversionId: conversion.id });
    return response({ status: "accepted", conversion_id: conversion.id }, 201, correlationId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.conversion.findUnique({
        where: { source_eventId: { source: MONEY_SITE_SOURCE, eventId: input.event_id } },
        select: conversionSelect,
      });
      if (existing) {
        return response({ status: "duplicate", conversion_id: existing.id }, 200, correlationId);
      }
    }

    logger.error("conversion.failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
    return apiErrorResponse(new ApiError("internal_error", 500, "Conversion could not be recorded."), correlationId);
  }
}
