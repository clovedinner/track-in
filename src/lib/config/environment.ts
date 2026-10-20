export type RuntimeEnvironment = {
  appUrl: string | undefined;
  trackerUrl: string | undefined;
  adminPassword: string | undefined;
  adminUsername: string | undefined;
  conversionWebhookSecret: string | undefined;
  authSessionSecret: string | undefined;
  databaseUrl: string | undefined;
  directDatabaseUrl: string | undefined;
  billingProvider: string | undefined;
  billingWalletAddress: string | undefined;
  tronGridApiKey: string | undefined;
  nowPaymentsApiKey: string | undefined;
  nowPaymentsIpnSecret: string | undefined;
  resendApiKey: string | undefined;
  nodeEnv: "development" | "production" | "test";
};

const supportedNodeEnvironments = new Set(["development", "production", "test"]);

function readTrimmedVariable(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === "" ? undefined : value;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const nodeEnvValue = process.env.NODE_ENV ?? "development";
  const nodeEnv = supportedNodeEnvironments.has(nodeEnvValue)
    ? (nodeEnvValue as RuntimeEnvironment["nodeEnv"])
    : "development";

  return {
    appUrl: readTrimmedVariable("NEXT_PUBLIC_APP_URL"),
    trackerUrl: readTrimmedVariable("NEXT_PUBLIC_TRACKER_URL"),
    adminPassword: readTrimmedVariable("ADMIN_PASSWORD"),
    adminUsername: readTrimmedVariable("ADMIN_USERNAME"),
    conversionWebhookSecret: readTrimmedVariable("CONVERSION_WEBHOOK_SECRET"),
    authSessionSecret: readTrimmedVariable("AUTH_SESSION_SECRET"),
    databaseUrl: readTrimmedVariable("DATABASE_URL"),
    directDatabaseUrl: readTrimmedVariable("DIRECT_URL"),
    billingProvider: readTrimmedVariable("BILLING_PROVIDER") ?? "tron",
    billingWalletAddress: readTrimmedVariable("BILLING_WALLET_ADDRESS"),
    tronGridApiKey: readTrimmedVariable("TRONGRID_API_KEY"),
    nowPaymentsApiKey: readTrimmedVariable("NOWPAYMENTS_API_KEY"),
    nowPaymentsIpnSecret: readTrimmedVariable("NOWPAYMENTS_IPN_SECRET"),
    resendApiKey: readTrimmedVariable("RESEND_API_KEY"),
    nodeEnv,
  };
}

export class EnvironmentValidationError extends Error {
  public constructor(public readonly missingVariables: string[]) {
    super(`Missing required environment variables: ${missingVariables.join(", ")}`);
    this.name = "EnvironmentValidationError";
  }
}

export function validateRuntimeEnvironment(
  environment = getRuntimeEnvironment(),
): RuntimeEnvironment {
  if (environment.nodeEnv !== "production") {
    return environment;
  }

  const requiredVariables = [
    ["NEXT_PUBLIC_APP_URL", environment.appUrl],
    ["CONVERSION_WEBHOOK_SECRET", environment.conversionWebhookSecret],
    ["AUTH_SESSION_SECRET", environment.authSessionSecret],
    ["DATABASE_URL", environment.databaseUrl],
    ["DIRECT_URL", environment.directDatabaseUrl],
    ["RESEND_API_KEY", environment.resendApiKey],
  ] as const;
  const missingVariables = requiredVariables
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new EnvironmentValidationError(missingVariables);
  }

  if (environment.billingProvider === "tron") {
    if (!environment.billingWalletAddress) throw new EnvironmentValidationError(["BILLING_WALLET_ADDRESS"]);
    if (!environment.tronGridApiKey) throw new EnvironmentValidationError(["TRONGRID_API_KEY"]);
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(environment.billingWalletAddress)) {
      throw new EnvironmentValidationError(["BILLING_WALLET_ADDRESS (must be a valid TRON address)"]);
    }
  } else if (environment.billingProvider === "nowpayments") {
    if (!environment.nowPaymentsApiKey) throw new EnvironmentValidationError(["NOWPAYMENTS_API_KEY"]);
    if (!environment.nowPaymentsIpnSecret) throw new EnvironmentValidationError(["NOWPAYMENTS_IPN_SECRET"]);
  } else {
    throw new EnvironmentValidationError(["BILLING_PROVIDER (must be tron or nowpayments)"]);
  }

  if (!environment.appUrl?.startsWith("https://")) {
    throw new EnvironmentValidationError(["NEXT_PUBLIC_APP_URL (must use https in production)"]);
  }

  if (environment.trackerUrl && !environment.trackerUrl.startsWith("https://")) {
    throw new EnvironmentValidationError(["NEXT_PUBLIC_TRACKER_URL (must use https in production)"]);
  }

  return environment;
}
