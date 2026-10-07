import { describe, expect, it } from "vitest";

import { adminNavigation, isAdminNavigationActive } from "./navigation";

describe("admin navigation", () => {
  it("keeps the verification link distinct from nested admin routes", () => {
    expect(isAdminNavigationActive("/admin", "/admin/dashboard")).toBe(false);
    expect(isAdminNavigationActive("/admin/dashboard", "/admin/dashboard")).toBe(true);
    expect(isAdminNavigationActive("/admin/campaigns", "/admin/campaigns/abc")).toBe(true);
  });

  it("exposes the core private destinations in a stable order", () => {
    expect(adminNavigation.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/dashboard",
      "/admin/campaigns",
      "/admin/offers",
      "/admin/traffic-sources",
      "/admin/delivery-health",
    ]);
  });
});
