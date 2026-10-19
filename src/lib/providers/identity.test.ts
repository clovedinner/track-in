import { describe, expect, it } from "vitest";

import { inferProviderIdFromTokenMacro } from "./identity";

describe("provider identity from token macros", () => {
  it.each([
    ["${SUBID}", "propeller"],
    ["{click_id}", "trafficstars"],
    ["{ACLID}", "trafficjunky"],
  ] as const)("infers %s as %s", (macro, providerId) => {
    expect(inferProviderIdFromTokenMacro(macro)).toBe(providerId);
  });

  it("does not guess an adapter for an unknown macro", () => {
    expect(inferProviderIdFromTokenMacro("${UNKNOWN_ID}")).toBeUndefined();
  });
});
