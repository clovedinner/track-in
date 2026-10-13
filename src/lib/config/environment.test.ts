import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  validateRuntimeEnvironment,
  type RuntimeEnvironment,
} from "./environment";

const productionEnvironment: RuntimeEnvironment = {
  appUrl: "https://tracker.example.com",
  adminPassword: "test-admin-password",
  adminUsername: "test-admin",
  conversionWebhookSecret: "test-conversion-secret",
  authSessionSecret: "test-auth-session-secret-0123456789",
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  directDatabaseUrl: "postgresql://test:test@localhost:5433/test",
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
      }),
    ).toThrow(EnvironmentValidationError);

    try {
      validateRuntimeEnvironment({
        ...productionEnvironment,
        adminPassword: undefined,
        conversionWebhookSecret: undefined,
        authSessionSecret: undefined,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect((error as EnvironmentValidationError).missingVariables).toEqual([
        "CONVERSION_WEBHOOK_SECRET",
        "AUTH_SESSION_SECRET",
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
});
