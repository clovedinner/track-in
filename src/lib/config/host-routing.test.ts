import { describe, expect, it } from "vitest";

import { getHostRedirectTarget, resolveRequestHostname } from "./host-routing";

describe("host routing", () => {
  const appUrl = "https://app.trakio.org";

  it("prefers the reverse proxy host and removes its port", () => {
    expect(resolveRequestHostname({ forwardedHost: "app.trakio.org:443", host: "127.0.0.1:3000", fallback: "localhost" }))
      .toBe("app.trakio.org");
    expect(resolveRequestHostname({ forwardedHost: null, host: "trakio.org:443", fallback: "localhost" }))
      .toBe("trakio.org");
  });

  it("opens the dashboard from the app subdomain root", () => {
    expect(getHostRedirectTarget({ hostname: "app.trakio.org", pathname: "/", search: "", appUrl }))
      .toBe("https://app.trakio.org/admin/dashboard");
  });

  it("moves private pages and auth links from the marketing host to the app", () => {
    expect(getHostRedirectTarget({ hostname: "trakio.org", pathname: "/admin/profile", search: "?tab=billing", appUrl }))
      .toBe("https://app.trakio.org/admin/profile?tab=billing");
    expect(getHostRedirectTarget({ hostname: "www.trakio.org", pathname: "/auth/verify-email", search: "?token=abc", appUrl }))
      .toBe("https://app.trakio.org/auth/verify-email?token=abc");
  });

  it("keeps campaign tracking, payment webhooks, and public pages on the root domain", () => {
    for (const pathname of ["/", "/t/campaign", "/postback", "/api/billing/nowpayments", "/api/conversions", "/docs"]) {
      expect(getHostRedirectTarget({ hostname: "trakio.org", pathname, search: "", appUrl })).toBeNull();
    }
  });

  it("does not route unrelated hosts", () => {
    expect(getHostRedirectTarget({ hostname: "trc01.trakio.org", pathname: "/", search: "", appUrl })).toBeNull();
  });

  it("keeps public docs on the main domain", () => {
    expect(getHostRedirectTarget({ hostname: "app.trakio.org", pathname: "/docs", search: "?topic=postbacks", appUrl }))
      .toBe("https://trakio.org/docs?topic=postbacks");
  });
});
