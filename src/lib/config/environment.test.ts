import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  validateRuntimeEnvironment,
  type RuntimeEnvironment,
} from "./environment";

const productionEnvironment: RuntimeEnvironment = {
  appUrl: "https://tracker.example.com",
  trackerUrl: "https://tracker.example.com",
  adminPassword: "test-admin-password",
  adminUsername: "test-admin",
  conversionWebhookSecret: "test-conversion-secret",
  authSessionSecret: "test-auth-session-secret-0123456789",
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  directDatabaseUrl: "postgresql://test:test@localhost:5433/test",
  billingProvider: "tron",
  billingWalletAddress: "TDmAYs4GfJLo3WHwbduMCRRK22XKsfw3uR",
  tronGridApiKey: "test-trongrid-key",
  nowPaymentsApiKey: undefined,
  nowPaymentsIpnSecret: undefined,
  resendApiKey: "re_test-resend-key",
  nodeEnv: "production",
};

describe("validateRuntimeEnvironment", () => {
  it("accepts complete production configuration", () => {
    expect(validateRuntimeEnvironment(productionEnvironment)).toEqual(productionEnvironment);
  });

  it("reports every missing production variable without exposing values", () => {
    expect(() =>
      validateRuntimeEnvironment({
        ...productionEnvironment,
        conversionWebhookSecret: undefined,
        authSessionSecret: undefined,
        resendApiKey: undefined,
      }),
    ).toThrow(EnvironmentValidationError);

    try {
      validateRuntimeEnvironment({
        ...productionEnvironment,
        adminPassword: undefined,
        conversionWebhookSecret: undefined,
        authSessionSecret: undefined,
        resendApiKey: undefined,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect((error as EnvironmentValidationError).missingVariables).toEqual([
        "CONVERSION_WEBHOOK_SECRET",
        "AUTH_SESSION_SECRET",
        "RESEND_API_KEY",
      ]);
    }
  });

  it("allows incomplete local configuration", () => {
    expect(
      validateRuntimeEnvironment({
        ...productionEnvironment,
        adminPassword: undefined,
        databaseUrl: undefined,
        nodeEnv: "development",
      }),
    ).toMatchObject({ nodeEnv: "development" });
  });

  it("rejects a non-HTTPS production origin", () => {
    expect(() =>
      validateRuntimeEnvironment({ ...productionEnvironment, appUrl: "http://tracker.example.com" }),
    ).toThrow(/https/);
  });

  it("rejects a non-HTTPS production tracker origin", () => {
    expect(() =>
      validateRuntimeEnvironment({ ...productionEnvironment, trackerUrl: "http://go.tracker.example.com" }),
    ).toThrow(/NEXT_PUBLIC_TRACKER_URL/);
  });

  it("requires a configured TRON wallet and TronGrid key for production billing", () => {
    expect(() => validateRuntimeEnvironment({ ...productionEnvironment, tronGridApiKey: undefined })).toThrow(/TRONGRID_API_KEY/);
    expect(() => validateRuntimeEnvironment({ ...productionEnvironment, billingWalletAddress: "invalid" })).toThrow(/valid TRON address/);
  });

  it("requires NOWPayments credentials when hosted checkout is selected", () => {
    const nowPaymentsEnvironment = {
      ...productionEnvironment,
      billingProvider: "nowpayments",
      billingWalletAddress: undefined,
      tronGridApiKey: undefined,
      nowPaymentsApiKey: "test-nowpayments-key",
      nowPaymentsIpnSecret: "test-nowpayments-ipn-secret",
    } satisfies RuntimeEnvironment;
    expect(validateRuntimeEnvironment(nowPaymentsEnvironment)).toEqual(nowPaymentsEnvironment);
    expect(() => validateRuntimeEnvironment({ ...nowPaymentsEnvironment, nowPaymentsIpnSecret: undefined })).toThrow(/NOWPAYMENTS_IPN_SECRET/);
  });
});
