import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminRequestAuthorized } from "@/lib/auth/admin";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);

  const session = await verifySessionToken(request.cookies.get(sessionCookieName())?.value);
  if (session || isAdminRequestAuthorized(request)) {
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

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { headers: { "x-request-id": correlationId }, status: 401 });
  }

  const signInUrl = new URL("/auth/sign-in", request.url);
  signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl, { headers: { "x-request-id": correlationId } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
