import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export async function GET(request: Request) {
  const requestId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser(); } catch {
    return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), requestId);
  }

  try {
    const [trafficSources, offers] = await Promise.all([
      prisma.trafficSource.findMany({
        where: { ownerId: user.id, enabled: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.offer.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      }),
    ]);
    return NextResponse.json({ trafficSources, offers }, { headers: { "x-request-id": requestId, "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("admin.campaign_options_failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiErrorResponse(new ApiError("internal_error", 500, "Unable to load campaign options."), requestId);
  }
}
