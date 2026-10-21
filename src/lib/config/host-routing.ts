const marketingHosts = new Set(["trakio.org", "www.trakio.org"]);
const marketingPagePaths = ["/docs", "/articles"];

function isAppPagePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    || pathname === "/auth" || pathname.startsWith("/auth/")
    || pathname === "/payment-done";
}

export function getHostRedirectTarget(input: {
  hostname: string;
  pathname: string;
  search: string;
  appUrl: string;
}): string | null {
  const hostname = input.hostname.toLowerCase();
  const appOrigin = new URL(input.appUrl);

  if (hostname === appOrigin.hostname && input.pathname === "/") {
    return new URL("/admin/dashboard", appOrigin).toString();
  }

  if (hostname === appOrigin.hostname && marketingPagePaths.some((path) => input.pathname === path || input.pathname.startsWith(`${path}/`))) {
    const target = new URL(input.pathname, "https://trakio.org");
    target.search = input.search;
    return target.toString();
  }

  if (marketingHosts.has(hostname) && isAppPagePath(input.pathname)) {
    const target = new URL(input.pathname, appOrigin);
    target.search = input.search;
    return target.toString();
  }

  return null;
}
