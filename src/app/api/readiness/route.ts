import { NextResponse } from "next/server";

import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { EnvironmentValidationError, validateRuntimeEnvironment } from "@/lib/config/environment";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export function GET(request: Request): NextResponse {
  const correlationId = getCorrelationId(request);

  try {
    validateRuntimeEnvironment();
    logger.info("health.readiness_checked", { requestId: correlationId, ready: true });

    return NextResponse.json(
      { status: "ready" },
      { headers: { "x-request-id": correlationId } },
    );
  } catch (error) {
    const apiError = new ApiError(
      "configuration_invalid",
      503,
      "The service is not ready.",
    );
    logger.error("health.readiness_failed", {
      errorName: error instanceof EnvironmentValidationError ? error.name : "UnknownError",
      requestId: correlationId,
    });

    return apiErrorResponse(apiError, correlationId);
  }
}
