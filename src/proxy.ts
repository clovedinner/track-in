import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminRequestAuthorized } from "@/lib/auth/admin";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export function proxy(request: NextRequest): NextResponse {
  const correlationId = getCorrelationId(request);

  if (isAdminRequestAuthorized(request)) {
    if (request.nextUrl.pathname === "/admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url), {
        headers: { "x-request-id": correlationId },
      });
    }

    return NextResponse.next({ headers: { "x-request-id": correlationId } });
  }

  logger.warn("admin.access_denied", {
    path: request.nextUrl.pathname,
    requestId: correlationId,
  });

  return new NextResponse("Authentication required.", {
    headers: {
      "www-authenticate": 'Basic realm="Track.in administration", charset="UTF-8"',
      "x-request-id": correlationId,
    },
    status: 401,
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
