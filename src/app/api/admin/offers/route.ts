import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { OfferInputError, parseOfferInput } from "@/lib/admin/offers";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCustomConversionCounts, includedCustomConversionColumns, type CustomConversionColumn } from "@/lib/admin/custom-conversion-metrics";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const user = await requireCurrentUser();
    const customConversions: CustomConversionColumn[] = await prisma.customConversion.findMany({ where: { ownerId: user.id, includeInConversions: true }, select: { id: true, name: true, eventValues: true, includeInConversions: true } });
    const offers = await prisma.offer.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, include: { campaigns: { select: { id: true, clicks: { select: { id: true, conversions: { select: { id: true, eventType: true } } } } } } } });
    const rows = offers.map((offer) => {
      const clicks = offer.campaigns.flatMap((campaign) => campaign.clicks);
      const conversions = clicks.flatMap((click) => click.conversions);
      return { id: offer.id, name: offer.name, offerUrl: offer.offerUrl, createdAt: offer.createdAt, visits: clicks.length, conversions: conversions.length, errors: 0, customConversionCounts: getCustomConversionCounts(conversions, includedCustomConversionColumns(customConversions)) };
    });
    return NextResponse.json({ offers: rows, customConversions: includedCustomConversionColumns(customConversions) }, { headers: { "x-request-id": correlationId } });
  } catch { return apiErrorResponse(new ApiError("internal_error", 500, "Unable to list offers."), correlationId); }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser(); } catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try { body = await request.json(); } catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId); }
  try {
    const input = parseOfferInput(body);
    const offer = await prisma.offer.create({ data: { ...input, ownerId: user.id }, select: { id: true, name: true, offerUrl: true, createdAt: true } });
    return NextResponse.json({ offer }, { status: 201, headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof OfferInputError) return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to create offer."), correlationId);
  }
}
