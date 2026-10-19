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
    const offer = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.offer.findFirst({ where: { id: offerId, ownerId: user.id }, select: { id: true } });
      if (!existing) return null;
      const updated = await transaction.offer.update({
        where: { id: offerId },
        data: { ...input, updatedAt: new Date() },
        select: { id: true, name: true, offerUrl: true, createdAt: true },
      });
      if (input.offerUrl) {
        await transaction.campaign.updateMany({
          where: { offerId, ownerId: user.id },
          data: { destinationUrl: input.offerUrl, updatedAt: new Date() },
        });
      }
      return updated;
    });
    if (!offer) return apiErrorResponse(new ApiError("not_found", 404, "Offer not found."), correlationId);
    return NextResponse.json({ offer }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof OfferInputError) return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update offer."), correlationId);
  }
}
