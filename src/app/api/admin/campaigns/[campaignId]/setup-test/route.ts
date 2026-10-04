import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

function testSetupEnabled(): boolean {
  return process.env.TRACK_IN_ALLOW_TEST_SETUP === "1" && process.env.NODE_ENV !== "production";
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  if (!testSetupEnabled()) return apiErrorResponse(new ApiError("not_found", 404, "Setup test is unavailable."), correlationId);
  const { campaignId } = await context.params;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true, destinationUrl: true, trafficSourceId: true } });
  if (!campaign || campaign.status !== "active") return apiErrorResponse(new ApiError("not_found", 404, "Active campaign not found."), correlationId);

  const clickId = `setup_${randomBytes(18).toString("base64url")}`;
  const destination = new URL(campaign.destinationUrl);
  destination.searchParams.set("cid", clickId);
  const click = await prisma.click.create({
    data: {
      clickId,
      campaignId: campaign.id,
      trafficSourceId: campaign.trafficSourceId,
      userAgent: "Track.in setup verification",
      referrer: "https://track.in/setup-test",
      destinationUrl: destination.toString(),
      trackingTokens: { _setupTest: true },
      correlationId: randomUUID(),
    },
    select: { clickId: true, destinationUrl: true, clickedAt: true },
  });
  logger.info("admin.campaign_setup_test_click_created", { campaignId, requestId: correlationId });
  return NextResponse.json({ status: "created", testOnly: true, click }, { headers: { "cache-control": "no-store", "x-request-id": correlationId } });
}
