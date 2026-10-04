export const adminNavigation = [
  { href: "/admin", label: "Verification" },
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/delivery-health", label: "Delivery health" },
] as const;

export function isAdminNavigationActive(href: string, pathname: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
