export const adminNavigation = [
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/traffic-sources", label: "Traffic sources" },
  { href: "/admin/delivery-health", label: "Delivery health" },
] as const;

export function isAdminNavigationActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
