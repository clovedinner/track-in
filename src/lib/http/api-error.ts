import { NextResponse } from "next/server";

import { logger } from "@/lib/observability/logger";

export type ApiErrorCode =
  | "configuration_invalid"
  | "conflict"
  | "invalid_request"
  | "internal_error"
  | "not_found"
  | "not_ready"
  | "unauthorized";

export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: ApiError, correlationId: string): NextResponse {
  logger.warn("api.request_failed", {
    code: error.code,
    requestId: correlationId,
    status: error.status,
  });

  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        request_id: correlationId,
      },
    },
    {
      headers: { "x-request-id": correlationId },
      status: error.status,
    },
  );
}
