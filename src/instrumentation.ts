import { validateRuntimeEnvironment } from "@/lib/config/environment";
import { logger } from "@/lib/observability/logger";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateRuntimeEnvironment();
    logger.info("application.configuration_validated");
  }
}
