import { describe, expect, it } from "vitest";

import { getRetryDelayMs, processDueOutbox, type OutboxJob, type OutboxRepository } from "./worker";

function repositoryFor(jobs: OutboxJob[]) {
  const updates: Record<string, unknown>[] = [];
  const repository: OutboxRepository = {
    async claimDue() {
      return jobs;
    },
    async markDelivered(jobId, details) {
      updates.push({ status: "delivered", jobId, ...details });
    },
    async markRetryableFailed(jobId, details) {
      updates.push({ status: "retryable_failed", jobId, ...details });
    },
    async markPermanentlyFailed(jobId, details) {
      updates.push({ status: "permanently_failed", jobId, ...details });
    },
  };
  return { repository, updates };
}

const job = (overrides: Partial<OutboxJob> = {}): OutboxJob => ({
  id: "job-1",
  attemptCount: 0,
  destination: "https://ads.example.test/postback",
  requestFingerprint: null,
  correlationId: "correlation-1",
  ...overrides,
});

describe("outbox worker", () => {
  it("marks a successful delivery as delivered", async () => {
    const { repository, updates } = repositoryFor([job()]);
    const result = await processDueOutbox(repository, async () => ({
      outcome: "delivered",
      responseStatus: 200,
      responseSummary: "accepted",
    }), "worker-1");

    expect(result).toEqual({ claimed: 1, delivered: 1, retrying: 0, permanentlyFailed: 0 });
    expect(updates[0]).toMatchObject({ status: "delivered", responseStatus: 200 });
  });

  it("schedules transient failures with bounded jittered backoff", async () => {
    const now = new Date("2026-10-04T00:00:00.000Z");
    const { repository, updates } = repositoryFor([job({ attemptCount: 1 })]);
    await processDueOutbox(repository, async () => ({ outcome: "failed", kind: "transient", error: "timeout" }), "worker-1", {
      now: () => now,
      baseDelayMs: 1_000,
      maxDelayMs: 5_000,
      random: () => 0,
    });

    expect(updates[0]).toMatchObject({ status: "retryable_failed", attemptCount: 2, error: "timeout" });
    expect((updates[0] as { nextAttemptAt: Date }).nextAttemptAt).toEqual(new Date("2026-10-04T00:00:01.000Z"));
  });

  it("does not retry permanent failures or exhausted transient failures", async () => {
    const { repository, updates } = repositoryFor([job({ id: "permanent" }), job({ id: "exhausted", attemptCount: 2 })]);
    const result = await processDueOutbox(repository, async (currentJob) =>
      currentJob.id === "permanent"
        ? { outcome: "failed", kind: "permanent", responseStatus: 400, error: "invalid token" }
        : { outcome: "failed", kind: "transient", responseStatus: 503, error: "unavailable" },
      "worker-1",
      { maxAttempts: 3 },
    );

    expect(result.permanentlyFailed).toBe(2);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "permanently_failed", jobId: "permanent", attemptCount: 1 }),
      expect.objectContaining({ status: "permanently_failed", jobId: "exhausted", attemptCount: 3 }),
    ]));
  });

  it("caps retry delay", () => {
    expect(getRetryDelayMs(20, { baseDelayMs: 1_000, maxDelayMs: 5_000, random: () => 1 })).toBe(5_000);
  });
});

