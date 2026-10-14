import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { OfferInputError, parseOfferInput } from "@/lib/admin/offers";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Context = { params: Promise<{ offerId: string }> };

export async function PATCH(request: Request, context: Context) {
  const correlationId = getCorrelationId(request);
  const { offerId } = await context.params;
  let user;
  try { user = await requireCurrentUser(); } catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId);
  }
  try {
    const input = parseOfferInput(body);
    const existing = await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true, ownerId: true } });
    if (!existing || existing.ownerId !== user.id) return apiErrorResponse(new ApiError("not_found", 404, "Offer not found."), correlationId);
    const offer = await prisma.offer.update({ where: { id: offerId }, data: input, select: { id: true, name: true, offerUrl: true, createdAt: true } });
    return NextResponse.json({ offer }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof OfferInputError) return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update offer."), correlationId);
  }
}
