import { NextResponse } from "next/server";

import { CampaignInputError, parseCreateCampaignInput } from "@/lib/admin/campaigns";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

function inputErrorResponse(error: CampaignInputError, correlationId: string): NextResponse {
  return apiErrorResponse(new ApiError("invalid_request", 400, `${error.field}: ${error.message}`), correlationId);
}

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        destinationUrl: true,
        trafficSourceId: true,
        defaultCurrency: true,
        allowedTrackingParameters: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
      },
    });

    return NextResponse.json({ campaigns }, { headers: { "x-request-id": correlationId } });
  } catch (error) {
    logger.error("admin.campaigns_list_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      requestId: correlationId,
    });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to list campaigns."), correlationId);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return inputErrorResponse(new CampaignInputError("body", "Request body must be valid JSON."), correlationId);
  }

  let input;
  try {
    input = parseCreateCampaignInput(body);
  } catch (error) {
    if (error instanceof CampaignInputError) {
      return inputErrorResponse(error, correlationId);
    }
    return apiErrorResponse(new ApiError("invalid_request", 400, "Invalid campaign data."), correlationId);
  }

  try {
    if (input.trafficSourceId) {
      const trafficSource = await prisma.trafficSource.findUnique({
        where: { id: input.trafficSourceId },
        select: { id: true, enabled: true },
      });

      if (!trafficSource || !trafficSource.enabled) {
        return apiErrorResponse(
          new ApiError("not_found", 404, "Traffic source not found or disabled."),
          correlationId,
        );
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        slug: input.slug,
        name: input.name,
        status: input.status,
        destinationUrl: input.destinationUrl,
        trafficSourceId: input.trafficSourceId,
        defaultCurrency: input.defaultCurrency,
        allowedTrackingParameters: input.allowedTrackingParameters,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        destinationUrl: true,
        trafficSourceId: true,
        defaultCurrency: true,
        allowedTrackingParameters: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
      },
    });

    logger.info("admin.campaign_created", { campaignId: campaign.id, requestId: correlationId });
    return NextResponse.json({ campaign }, { headers: { "x-request-id": correlationId }, status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return apiErrorResponse(new ApiError("conflict", 409, "A campaign with that slug already exists."), correlationId);
    }

    logger.error("admin.campaign_create_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      requestId: correlationId,
    });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to create campaign."), correlationId);
  }
}
