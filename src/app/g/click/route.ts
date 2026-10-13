import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import { collectTrackingTokens, createClickId } from "@/lib/tracking/click";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, string>, status: number, correlationId: string): Response {
  return NextResponse.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store, max-age=0",
      "x-request-id": correlationId,
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);
  const rawCampaignId = url.searchParams.get("cpid");
  const rawOfferId = url.searchParams.get("oid");
  const campaignId = rawCampaignId === null ? null : rawCampaignId.trim();
  const offerId = rawOfferId === null ? null : rawOfferId.trim();

  if (!campaignId || !uuidPattern.test(campaignId) || (offerId !== null && !uuidPattern.test(offerId))) {
    return json({ error: "invalid_direct_context" }, 400, correlationId);
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        status: "active",
        trackingMode: "direct",
        ...(offerId === null ? {} : { offerId }),
      },
      select: {
        id: true,
        destinationUrl: true,
        trafficSourceId: true,
        allowedTrackingParameters: true,
      },
    });

    if (!campaign) return json({ error: "campaign_not_found" }, 404, correlationId);

    const clickId = createClickId();
    const trackingTokens = collectTrackingTokens(url.searchParams, campaign.allowedTrackingParameters);
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;

    await prisma.click.create({
      data: {
        clickId,
        campaignId: campaign.id,
        trafficSourceId: campaign.trafficSourceId,
        clickedAt: new Date(),
        ipAddress,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        destinationUrl: campaign.destinationUrl,
        trackingTokens,
        correlationId,
      },
    });

    logger.info("tracking.direct_click_recorded", { campaignId, correlationId });
    return json({ cid: clickId }, 200, correlationId);
  } catch (error) {
    logger.error("tracking.direct_click_failed", {
      campaignId,
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ error: "direct_click_unavailable" }, 500, correlationId);
  }
}
