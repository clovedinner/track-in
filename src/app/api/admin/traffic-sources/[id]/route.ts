import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

import { parseTrafficSourceId, parseTrafficSourceInput, safeTrafficSourceConfiguration, TrafficSourceInputError } from "@/lib/admin/traffic-sources";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

type Source = { id: string; name: string; type: string; enabled: boolean; credentialSecretRef: string | null; configuration: unknown; retryPolicy: unknown; createdAt: Date; updatedAt: Date };
const select = { id: true, name: true, type: true, enabled: true, credentialSecretRef: true, configuration: true, retryPolicy: true, createdAt: true, updatedAt: true } as const;
function safe(source: Source) { return { id: source.id, name: source.name, type: source.type, enabled: source.enabled, hasCredentialSecretRef: source.credentialSecretRef !== null, configuration: safeTrafficSourceConfiguration(source.configuration), retryPolicy: source.retryPolicy, createdAt: source.createdAt, updatedAt: source.updatedAt }; }
function inputError(error: TrafficSourceInputError, id: string) { return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), id); }

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  let id: string;
  try { id = parseTrafficSourceId((await context.params).id); } catch (error) { return inputError(error as TrafficSourceInputError, correlationId); }
  let body: unknown;
  try { body = await request.json(); } catch { return inputError(new TrafficSourceInputError("body", "Request body must be valid JSON."), correlationId); }
  let input;
  try { input = parseTrafficSourceInput(body); } catch (error) { return error instanceof TrafficSourceInputError ? inputError(error, correlationId) : apiErrorResponse(new ApiError("invalid_request", 400, "Invalid traffic source data."), correlationId); }
  try {
    const source = await prisma.trafficSource.update({
      where: { id },
      data: {
        ...input,
        configuration: input.configuration as Prisma.InputJsonValue,
        retryPolicy: input.retryPolicy as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      select,
    });
    logger.info("admin.traffic_source_updated", { trafficSourceId: id, provider: source.type, requestId: correlationId });
    return NextResponse.json({ trafficSource: safe(source) }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return apiErrorResponse(new ApiError("not_found", 404, "Traffic source not found."), correlationId);
    logger.error("admin.traffic_source_update_failed", { errorName: error instanceof Error ? error.name : "UnknownError", requestId: correlationId });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update traffic source."), correlationId);
  }
}
