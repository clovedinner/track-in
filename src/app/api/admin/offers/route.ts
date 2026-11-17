import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { OfferInputError, parseOfferInput } from "@/lib/admin/offers";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCustomConversionCounts } from "@/lib/admin/custom-conversion-metrics";

type OfferActivity = { offerId: string; eventType: string | null; count: bigint };

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const user = await requireCurrentUser();
    const [offers, customConversions, activity] = await Promise.all([
      prisma.offer.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, offerUrl: true, createdAt: true },
      }),
      prisma.customConversion.findMany({
        where: { ownerId: user.id, includeInConversions: true },
        select: { id: true, name: true, eventValues: true, includeInConversions: true },
      }),
      prisma.$queryRaw<OfferActivity[]>`
        WITH offer_campaigns AS (
          SELECT campaigns.id, campaigns.offer_id
          FROM campaigns
          JOIN offers ON offers.id = campaigns.offer_id
          WHERE offers.owner_id = ${user.id}::uuid AND campaigns.owner_id = ${user.id}::uuid
        )
        SELECT offer_campaigns.offer_id AS "offerId", NULL::text AS "eventType", COUNT(*) AS count
        FROM offer_campaigns
        JOIN clicks ON clicks.campaign_id = offer_campaigns.id
        GROUP BY offer_campaigns.offer_id
        UNION ALL
        SELECT offer_campaigns.offer_id AS "offerId", conversions.event_type AS "eventType", COUNT(*) AS count
        FROM offer_campaigns
        JOIN clicks ON clicks.campaign_id = offer_campaigns.id
        JOIN conversions ON conversions.click_record_id = clicks.id
        GROUP BY offer_campaigns.offer_id, conversions.event_type
      `,
    ]);

    const visitsByOffer = new Map<string, number>();
    const conversionsByOffer = new Map<string, { eventType: string; count: number }[]>();
    for (const { offerId, eventType, count } of activity) {
      if (eventType === null) {
        visitsByOffer.set(offerId, Number(count));
        continue;
      }
      const eventCounts = conversionsByOffer.get(offerId) ?? [];
      eventCounts.push({ eventType, count: Number(count) });
      conversionsByOffer.set(offerId, eventCounts);
    }

    const rows = offers.map((offer) => {
      const eventCounts = conversionsByOffer.get(offer.id) ?? [];
      return {
        ...offer,
        visits: visitsByOffer.get(offer.id) ?? 0,
        conversions: eventCounts.reduce((total, event) => total + event.count, 0),
        errors: 0,
        customConversionCounts: getCustomConversionCounts(eventCounts, customConversions),
      };
    });
    return NextResponse.json({ offers: rows, customConversions }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    logger.error("admin.offer_list_failed", { requestId: correlationId, errorType: error instanceof Error ? error.name : "Unknown" });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to list offers."), correlationId);
  }
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
