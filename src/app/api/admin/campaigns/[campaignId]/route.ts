import { NextResponse } from "next/server";
import { CampaignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";

type Context = { params: Promise<{ campaignId: string }> };

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { campaignId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId); }
  const status = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).status : undefined;
  if (status !== CampaignStatus.active && status !== CampaignStatus.paused) {
    return apiErrorResponse(new ApiError("invalid_request", 400, "status must be active or paused."), correlationId);
  }
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, destinationUrl: true, trafficSource: { select: { enabled: true } } } });
    if (!campaign) return apiErrorResponse(new ApiError("not_found", 404, "Campaign not found."), correlationId);
    if (status === CampaignStatus.active && (!campaign.destinationUrl.startsWith("https://") || campaign.trafficSource?.enabled !== true)) {
      return apiErrorResponse(new ApiError("invalid_request", 400, "Campaign needs an HTTPS destination and an enabled traffic source before activation."), correlationId);
    }
    const updated = await prisma.campaign.update({ where: { id: campaignId }, data: { status }, select: { id: true, status: true } });
    return NextResponse.json({ campaign: updated }, { headers: { "x-request-id": correlationId } });
  } catch { return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update campaign status."), correlationId); }
}
