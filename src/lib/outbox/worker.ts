export type OutboxStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "retryable_failed"
  | "permanently_failed"
  | "suppressed";

export type OutboxJob = {
  id: string;
  attemptCount: number;
  destination: string;
  requestFingerprint: string | null;
  correlationId: string;
  /** Provider context is loaded by the Prisma repository for adapter delivery. */
  providerId?: string;
  providerConfiguration?: unknown;
  clickTokens?: Record<string, unknown>;
  conversion?: {
    eventId: string;
    eventType: string;
    valueMinor: bigint;
    currency: string;
  };
};

export type DeliverySuccess = {
  outcome: "delivered";
  responseStatus?: number;
  responseSummary?: string;
};

export type DeliveryFailure = {
  outcome: "failed";
  kind: "transient" | "permanent";
  responseStatus?: number;
  error: string;
};

export type DeliveryResult = DeliverySuccess | DeliveryFailure;

export type OutboxRepository = {
  claimDue(limit: number, workerId: string, now: Date): Promise<OutboxJob[]>;
  markDelivered(jobId: string, details: { responseStatus?: number; responseSummary?: string; now: Date }): Promise<void>;
  markRetryableFailed(
    jobId: string,
    details: { attemptCount: number; nextAttemptAt: Date; responseStatus?: number; error: string; now: Date },
  ): Promise<void>;
  markPermanentlyFailed(
    jobId: string,
    details: { attemptCount: number; responseStatus?: number; error: string; now: Date },
  ): Promise<void>;
};

export type OutboxDelivery = (job: OutboxJob) => Promise<DeliveryResult>;

export type OutboxWorkerOptions = {
  batchSize?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  now?: () => Date;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_DELAY_MS = 30_000;
const DEFAULT_MAX_DELAY_MS = 60 * 60 * 1_000;

export function getRetryDelayMs(
  attemptCount: number,
  options: Pick<OutboxWorkerOptions, "baseDelayMs" | "maxDelayMs" | "random"> = {},
): number {
  const base = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maximum = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const random = Math.min(1, Math.max(0, options.random?.() ?? Math.random()));
  const exponential = Math.min(maximum, base * 2 ** Math.max(0, attemptCount - 1));
  // Full jitter avoids a group of workers retrying an outage at the same instant.
  return Math.floor(exponential * (0.5 + random * 0.5));
}

export async function processDueOutbox(
  repository: OutboxRepository,
  deliver: OutboxDelivery,
  workerId: string,
  options: OutboxWorkerOptions = {},
): Promise<{ claimed: number; delivered: number; retrying: number; permanentlyFailed: number }> {
  const now = options.now ?? (() => new Date());
  const claimed = await repository.claimDue(options.batchSize ?? DEFAULT_BATCH_SIZE, workerId, now());
  let delivered = 0;
  let retrying = 0;
  let permanentlyFailed = 0;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (const job of claimed) {
    const timestamp = now();
    let result: DeliveryResult;
    try {
      result = await deliver(job);
    } catch (error) {
      result = {
        outcome: "failed",
        kind: "transient",
        error: error instanceof Error ? error.message : "Unknown delivery error",
      };
    }

    if (result.outcome === "delivered") {
      await repository.markDelivered(job.id, {
        now: timestamp,
        responseStatus: result.responseStatus,
        responseSummary: result.responseSummary,
      });
      delivered += 1;
      continue;
    }

    const nextAttemptCount = job.attemptCount + 1;
    const exhausted = nextAttemptCount >= maxAttempts;
    if (result.kind === "permanent" || exhausted) {
      await repository.markPermanentlyFailed(job.id, {
        attemptCount: nextAttemptCount,
        now: timestamp,
        responseStatus: result.responseStatus,
        error: result.error.slice(0, 1_000),
      });
      permanentlyFailed += 1;
      continue;
    }

    await repository.markRetryableFailed(job.id, {
      attemptCount: nextAttemptCount,
      nextAttemptAt: new Date(timestamp.getTime() + getRetryDelayMs(nextAttemptCount, options)),
      now: timestamp,
      responseStatus: result.responseStatus,
      error: result.error.slice(0, 1_000),
    });
    retrying += 1;
  }

  return { claimed: claimed.length, delivered, retrying, permanentlyFailed };
}

