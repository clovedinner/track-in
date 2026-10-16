import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { CustomConversionInputError, parseCustomConversionInput } from "@/lib/admin/custom-conversions";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCorrelationId } from "@/lib/observability/correlation-id";

type Context = { params: Promise<{ id: string }> };

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isReferenced(configuration: unknown, customConversionId: string) {
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration)) return false;
  const mappings = (configuration as Record<string, unknown>).eventPostbacks;
  if (!Array.isArray(mappings)) return false;
  return mappings.some((mapping) => typeof mapping === "object" && mapping !== null && !Array.isArray(mapping) && (mapping as Record<string, unknown>).customConversionId === customConversionId);
}

export async function PATCH(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const { id } = await context.params;
  let user;
  try { user = await requireCurrentUser(); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId); }

  try {
    const input = parseCustomConversionInput(body);
    const current = await prisma.customConversion.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
    if (!current) return apiErrorResponse(new ApiError("not_found", 404, "Custom conversion not found."), correlationId);
    if (!input.sendPostbackToTrafficSource) {
      const sources = await prisma.trafficSource.findMany({ where: { ownerId: user.id }, select: { configuration: true } });
      if (sources.some((source) => isReferenced(source.configuration, id))) {
        return apiErrorResponse(new ApiError("conflict", 409, "Remove this event from its traffic-source postback mapping before disabling its postback."), correlationId);
      }
    }
    const existing = await prisma.customConversion.findMany({ where: { ownerId: user.id, id: { not: id } }, select: { name: true, eventValues: true } });
    if (existing.some((item) => item.name.toLowerCase() === input.name.toLowerCase())) return apiErrorResponse(new ApiError("conflict", 409, "A custom conversion with this name already exists."), correlationId);
    const usedValues = new Set(existing.flatMap((item) => item.eventValues));
    if (input.eventValues.some((eventValue) => usedValues.has(eventValue))) return apiErrorResponse(new ApiError("conflict", 409, "Each event value can belong to only one custom conversion."), correlationId);
    const customConversion = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.customConversion.update({ where: { id }, data: input });
      await transaction.auditEntry.create({ data: { action: "custom_conversion.updated", entityType: "custom_conversion", entityId: id, actor: user.email, metadata: { eventValueCount: input.eventValues.length }, correlationId } });
      return updated;
    });
    return NextResponse.json({ customConversion }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof CustomConversionInputError) return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("conflict", 409, "A custom conversion with this name already exists."), correlationId);
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update custom conversion."), correlationId);
  }
}

export async function DELETE(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const { id } = await context.params;
  let user;
  try { user = await requireCurrentUser(); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  try {
    const current = await prisma.customConversion.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
    if (!current) return apiErrorResponse(new ApiError("not_found", 404, "Custom conversion not found."), correlationId);
    const sources = await prisma.trafficSource.findMany({ where: { ownerId: user.id }, select: { configuration: true } });
    if (sources.some((source) => isReferenced(source.configuration, id))) {
      return apiErrorResponse(new ApiError("conflict", 409, "Remove this event from its traffic-source postback mapping before deleting it."), correlationId);
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.customConversion.delete({ where: { id } });
      await transaction.auditEntry.create({ data: { action: "custom_conversion.deleted", entityType: "custom_conversion", entityId: id, actor: user.email, metadata: {}, correlationId } });
    });
    return NextResponse.json({ deleted: true }, { headers: { "x-request-id": correlationId } });
  } catch {
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to delete custom conversion."), correlationId);
  }
}
