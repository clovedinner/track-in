import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import { collectTrackingTokens, createClickId, enabledTrafficSourceParameters } from "@/lib/tracking/click";

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

function jsonp(callback: string, body: Record<string, string>, status: number, correlationId: string): Response {
  return new Response(`${callback}(${JSON.stringify(body)});`, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "application/javascript; charset=utf-8",
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
  const callback = url.searchParams.get("callback");
  const respond = (body: Record<string, string>, status: number): Response => callback && /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(callback)
    ? jsonp(callback, body, status, correlationId)
    : json(body, status, correlationId);

  if (!campaignId || !uuidPattern.test(campaignId) || (offerId !== null && !uuidPattern.test(offerId))) {
    return respond({ error: "invalid_direct_context" }, 400);
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
        trafficSource: { select: { configuration: true } },
      },
    });

    if (!campaign) return respond({ error: "campaign_not_found" }, 404);

    const clickId = createClickId();
    const configuredParameters = enabledTrafficSourceParameters(campaign.trafficSource?.configuration);
    const allowedParameters = configuredParameters.length > 0 ? configuredParameters : campaign.allowedTrackingParameters;
    const trackingTokens = collectTrackingTokens(url.searchParams, allowedParameters);
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
    return respond({ cid: clickId }, 200);
  } catch (error) {
    logger.error("tracking.direct_click_failed", {
      campaignId,
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return respond({ error: "direct_click_unavailable" }, 500);
  }
}
