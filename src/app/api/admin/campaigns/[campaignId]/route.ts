import { NextResponse } from "next/server";
import { CampaignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { CampaignInputError, parseCampaignSettingsPatch } from "@/lib/admin/campaigns";
import { logger } from "@/lib/observability/logger";

type Context = { params: Promise<{ campaignId: string }> };

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const { campaignId } = await context.params;
  let user;
  try { user = await requireCurrentUser(); } catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), correlationId); }
  let body: unknown;
  try { body = await request.json(); } catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), correlationId); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be a JSON object."), correlationId);
  }
  const input = body as Record<string, unknown>;
  const { status } = input;
  if (status !== undefined && status !== CampaignStatus.active && status !== CampaignStatus.paused) {
    return apiErrorResponse(new ApiError("invalid_request", 400, "status must be active or paused."), correlationId);
  }
  try {
    const settings = parseCampaignSettingsPatch(input);
    const data = { ...settings, ...(status !== undefined ? { status } : {}) };
    if (Object.keys(data).length === 0) {
      return apiErrorResponse(new ApiError("invalid_request", 400, "Provide at least one editable campaign field."), correlationId);
    }
    const updated = await prisma.$transaction(async (transaction) => {
      const campaign = await transaction.campaign.findUnique({ where: { id: campaignId, ownerId: user.id }, select: { destinationUrl: true, trafficSource: { select: { enabled: true } } } });
      if (!campaign) throw new ApiError("not_found", 404, "Campaign not found.");

      let sourceEnabled = campaign.trafficSource?.enabled === true;
      if (settings.trafficSourceId) {
        const source = await transaction.trafficSource.findUnique({ where: { id: settings.trafficSourceId, ownerId: user.id }, select: { enabled: true } });
        if (!source?.enabled) throw new ApiError("not_found", 404, "Traffic source not found or disabled.");
        sourceEnabled = true;
      }
      if (settings.offerId) {
        const offer = await transaction.offer.findUnique({ where: { id: settings.offerId, ownerId: user.id }, select: { offerUrl: true } });
        if (!offer) throw new ApiError("not_found", 404, "Offer not found.");
        if (!offer.offerUrl?.startsWith("https://")) throw new ApiError("invalid_request", 400, "Selected offer does not have an HTTPS offer URL.");
        data.destinationUrl = offer.offerUrl;
      }
      if (status === CampaignStatus.active && (!(data.destinationUrl ?? campaign.destinationUrl).startsWith("https://") || !sourceEnabled)) {
        throw new ApiError("invalid_request", 400, "Campaign needs an HTTPS destination and an enabled traffic source before activation.");
      }
      const updated = await transaction.campaign.update({ where: { id: campaignId, ownerId: user.id }, data, select: { id: true, status: true } });
      await transaction.auditEntry.create({ data: {
        action: "campaign.updated",
        entityType: "campaign",
        entityId: campaignId,
        actor: user.email,
        metadata: { fields: Object.keys(data) },
        correlationId,
      } });
      return updated;
    });
    return NextResponse.json({ campaign: updated }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, correlationId);
    if (error instanceof CampaignInputError) {
      return apiErrorResponse(new ApiError("invalid_request", 400, error.message), correlationId);
    }
    logger.error("admin.campaign_update_failed", { requestId: correlationId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to update campaign."), correlationId);
  }
}
