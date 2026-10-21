import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminRequestAuthorized } from "@/lib/auth/admin";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getCorrelationId } from "@/lib/observability/correlation-id";
import { logger } from "@/lib/observability/logger";
import { getHostRedirectTarget, resolveRequestHostname } from "@/lib/config/host-routing";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  const path = request.nextUrl.pathname;

  if (process.env.NODE_ENV === "production") {
    const redirectTarget = getHostRedirectTarget({
      hostname: resolveRequestHostname({
        forwardedHost: request.headers.get("x-forwarded-host"),
        host: request.headers.get("host"),
        fallback: request.nextUrl.hostname,
      }),
      pathname: path,
      search: request.nextUrl.search,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trakio.org",
    });
    if (redirectTarget) {
      return NextResponse.redirect(redirectTarget, {
        headers: { "Cache-Control": "no-store", "x-request-id": correlationId },
      });
    }
  }

  if (!path.startsWith("/admin/") && path !== "/admin" && !path.startsWith("/api/admin/")) {
    return NextResponse.next({ headers: { "x-request-id": correlationId } });
  }

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

  const signInUrl = new URL("/auth/sign-in", process.env.NEXT_PUBLIC_APP_URL ?? request.url);
  signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl, { headers: { "x-request-id": correlationId } });
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*", "/auth/:path*", "/payment-done", "/docs/:path*", "/articles/:path*", "/about/:path*", "/features/:path*", "/pricing/:path*"],
};
