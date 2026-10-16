import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

import {
  postbackEventConversionIds,
  parseTrafficSourceInput,
  safeTrafficSourceConfiguration,
  TrafficSourceInputError,
} from "@/lib/admin/traffic-sources";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import { requireCurrentUser } from "@/lib/auth/current-user";

function errorResponse(error: TrafficSourceInputError, correlationId: string): NextResponse {
  return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
}

function safeSource(source: {
  id: string; name: string; type: string; enabled: boolean; credentialSecretRef: string | null;
  configuration: unknown; retryPolicy: unknown; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    enabled: source.enabled,
    hasCredentialSecretRef: source.credentialSecretRef !== null,
    configuration: safeTrafficSourceConfiguration(source.configuration),
    retryPolicy: source.retryPolicy,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

const sourceSelect = {
  id: true, name: true, type: true, enabled: true, credentialSecretRef: true,
  configuration: true, retryPolicy: true, createdAt: true, updatedAt: true,
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  try {
    const user = await requireCurrentUser();
    const sources = await prisma.trafficSource.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: sourceSelect });
    return NextResponse.json({ trafficSources: sources.map(safeSource) }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    logger.error("admin.traffic_sources_list_failed", { errorName: error instanceof Error ? error.name : "UnknownError", requestId: correlationId });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to list traffic sources."), correlationId);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser(); } catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse(new TrafficSourceInputError("body", "Request body must be valid JSON."), correlationId); }
  let input;
  try { input = parseTrafficSourceInput(body); } catch (error) {
    return error instanceof TrafficSourceInputError ? errorResponse(error, correlationId) : apiErrorResponse(new ApiError("invalid_request", 400, "Invalid traffic source data."), correlationId);
  }
  const eventConversionIds = postbackEventConversionIds(input.configuration);
  if (eventConversionIds.length > 0) {
    const available = await prisma.customConversion.findMany({ where: { ownerId: user.id, id: { in: eventConversionIds }, sendPostbackToTrafficSource: true }, select: { id: true } });
    if (available.length !== eventConversionIds.length) return errorResponse(new TrafficSourceInputError("configuration", "Every event postback must reference an enabled custom conversion in this account."), correlationId);
  }
  try {
    const source = await prisma.trafficSource.create({
      data: {
        ownerId: user.id,
        ...input,
        configuration: input.configuration as Prisma.InputJsonValue,
        retryPolicy: input.retryPolicy as Prisma.InputJsonValue,
      },
      select: sourceSelect,
    });
    logger.info("admin.traffic_source_created", { trafficSourceId: source.id, provider: source.type, requestId: correlationId });
    return NextResponse.json({ trafficSource: safeSource(source) }, { status: 201, headers: { "x-request-id": correlationId } });
  } catch (error) {
    logger.error("admin.traffic_source_create_failed", { errorName: error instanceof Error ? error.name : "UnknownError", requestId: correlationId });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to create traffic source."), correlationId);
  }
}
