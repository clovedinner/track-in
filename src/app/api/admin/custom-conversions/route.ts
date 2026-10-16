import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { CustomConversionInputError, MAX_CUSTOM_CONVERSIONS, parseCustomConversionInput } from "@/lib/admin/custom-conversions";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCorrelationId } from "@/lib/observability/correlation-id";

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const user = await requireCurrentUser();
    const customConversions = await prisma.customConversion.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, eventValues: true, includeInConversions: true, includeInRevenue: true, sendPostbackToTrafficSource: true, includeInCost: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ customConversions, limit: MAX_CUSTOM_CONVERSIONS }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    const status = error instanceof Error && error.message === "Authentication required." ? 401 : 500;
    return apiErrorResponse(new ApiError(status === 401 ? "unauthorized" : "internal_error", status, status === 401 ? "Authentication required." : "Unable to list custom conversions."), correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser(); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId); }

  try {
    const input = parseCustomConversionInput(body);
    const existing = await prisma.customConversion.findMany({ where: { ownerId: user.id }, select: { name: true, eventValues: true } });
    if (existing.length >= MAX_CUSTOM_CONVERSIONS) return apiErrorResponse(new ApiError("conflict", 409, `You can create up to ${MAX_CUSTOM_CONVERSIONS} custom conversions.`), correlationId);
    if (existing.some((item) => item.name.toLowerCase() === input.name.toLowerCase())) return apiErrorResponse(new ApiError("conflict", 409, "A custom conversion with this name already exists."), correlationId);
    const usedValues = new Set(existing.flatMap((item) => item.eventValues));
    if (input.eventValues.some((eventValue) => usedValues.has(eventValue))) return apiErrorResponse(new ApiError("conflict", 409, "Each event value can belong to only one custom conversion."), correlationId);
    const customConversion = await prisma.$transaction(async (transaction) => {
      const created = await transaction.customConversion.create({ data: { ...input, ownerId: user.id } });
      await transaction.auditEntry.create({ data: { action: "custom_conversion.created", entityType: "custom_conversion", entityId: created.id, actor: user.email, metadata: { eventValueCount: input.eventValues.length }, correlationId } });
      return created;
    });
    return NextResponse.json({ customConversion }, { status: 201, headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof CustomConversionInputError) return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
    if (isUniqueConflict(error)) return apiErrorResponse(new ApiError("conflict", 409, "A custom conversion with this name already exists."), correlationId);
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to create custom conversion."), correlationId);
  }
}
