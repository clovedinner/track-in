import os from "node:os";

import { config } from "dotenv";

const environmentFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
config({ path: environmentFile });

const pollIntervalMs = readPositiveInteger(process.env.OUTBOX_POLL_INTERVAL_MS, 5_000);
const workerId = `outbox-${os.hostname()}-${process.pid}`;
let stopping = false;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const [{ prisma }, { createPrismaOutboxRepository }, { createProviderOutboxDelivery }, { processDueOutbox }] = await Promise.all([
    import("@/lib/database/prisma"),
    import("@/lib/outbox/prisma-repository"),
    import("@/lib/outbox/provider-delivery"),
    import("@/lib/outbox/worker"),
  ]);
  const repository = createPrismaOutboxRepository(prisma);
  const deliver = createProviderOutboxDelivery(fetch);

  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.info(`[outbox] worker ${workerId} started; polling every ${pollIntervalMs}ms`);
  try {
    while (!stopping) {
      try {
        const result = await processDueOutbox(repository, deliver, workerId);
        if (result.claimed > 0) {
          console.info(`[outbox] claimed=${result.claimed} delivered=${result.delivered} retrying=${result.retrying} permanentlyFailed=${result.permanentlyFailed}`);
        }
        if (result.claimed === 0) await wait(pollIntervalMs);
      } catch (error) {
        console.error("[outbox] processing cycle failed", error instanceof Error ? error.message : "unknown error");
        await wait(pollIntervalMs);
      }
    }
  } finally {
    await prisma.$disconnect();
    console.info(`[outbox] worker ${workerId} stopped`);
  }
}

void main().catch((error: unknown) => {
  console.error("[outbox] worker failed to start", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
