import { NextResponse } from "next/server";

import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export function GET(request: Request): NextResponse {
  const correlationId = getCorrelationId(request);
  logger.info("health.liveness_checked", { requestId: correlationId });

  return NextResponse.json(
    { status: "ok" },
    { headers: { "x-request-id": correlationId } },
  );
}
