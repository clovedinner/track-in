import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import {
  buildTrackingDestination,
  collectTrackingTokens,
  createClickId,
} from "@/lib/tracking/click";

type TrackingRouteContext = {
  params: Promise<{ campaignSlug: string }>;
};

export async function GET(request: Request, context: TrackingRouteContext): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const { campaignSlug } = await context.params;

  const campaign = await prisma.campaign.findFirst({
    where: {
      slug: campaignSlug,
      status: "active",
    },
    select: {
      id: true,
      destinationUrl: true,
      trafficSourceId: true,
      allowedTrackingParameters: true,
    },
  });

  if (!campaign) {
    logger.warn("tracking.campaign_not_found", { campaignSlug, correlationId });
    return new NextResponse("Campaign not found.", {
      status: 404,
      headers: { "x-request-id": correlationId },
    });
  }

  const clickId = createClickId();
  const trackingTokens = collectTrackingTokens(
    new URL(request.url).searchParams,
    campaign.allowedTrackingParameters,
  );
  const destination = buildTrackingDestination(campaign.destinationUrl, clickId, trackingTokens);
  const requestUrl = new URL(request.url);
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
      destinationUrl: destination.toString(),
      trackingTokens,
      correlationId,
    },
  });

  logger.info("tracking.click_recorded", {
    campaignSlug,
    correlationId,
    requestHost: requestUrl.host,
  });

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      "x-request-id": correlationId,
    },
  });
}
