import { afterEach, describe, expect, it, vi } from "vitest";

import { canUseBillingTestMode } from "./test-access";

afterEach(() => vi.unstubAllEnvs());

describe("canUseBillingTestMode", () => {
  it("only enables the test for the configured user", () => {
    vi.stubEnv("BILLING_TEST_MODE", "true");
    vi.stubEnv("BILLING_TEST_USER_ID", "test-user-id");

    expect(canUseBillingTestMode("test-user-id")).toBe(true);
    expect(canUseBillingTestMode("another-user-id")).toBe(false);
  });

  it("stays disabled when the account allowlist is missing", () => {
    vi.stubEnv("BILLING_TEST_MODE", "true");
    vi.stubEnv("BILLING_TEST_USER_ID", "");

    expect(canUseBillingTestMode("test-user-id")).toBe(false);
  });
});
