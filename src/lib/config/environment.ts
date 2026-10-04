export type RuntimeEnvironment = {
  appUrl: string | undefined;
  adminPassword: string | undefined;
  adminUsername: string | undefined;
  conversionWebhookSecret: string | undefined;
  databaseUrl: string | undefined;
  directDatabaseUrl: string | undefined;
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
    adminPassword: readTrimmedVariable("ADMIN_PASSWORD"),
    adminUsername: readTrimmedVariable("ADMIN_USERNAME"),
    conversionWebhookSecret: readTrimmedVariable("CONVERSION_WEBHOOK_SECRET"),
    databaseUrl: readTrimmedVariable("DATABASE_URL"),
    directDatabaseUrl: readTrimmedVariable("DIRECT_URL"),
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
    ["ADMIN_USERNAME", environment.adminUsername],
    ["ADMIN_PASSWORD", environment.adminPassword],
    ["CONVERSION_WEBHOOK_SECRET", environment.conversionWebhookSecret],
    ["DATABASE_URL", environment.databaseUrl],
    ["DIRECT_URL", environment.directDatabaseUrl],
  ] as const;
  const missingVariables = requiredVariables
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new EnvironmentValidationError(missingVariables);
  }

  if (!environment.appUrl?.startsWith("https://")) {
    throw new EnvironmentValidationError(["NEXT_PUBLIC_APP_URL (must use https in production)"]);
  }

  return environment;
}
