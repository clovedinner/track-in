import type { PrismaClient } from "@/generated/prisma/client";
import { OutboundPostbackStatus } from "@/generated/prisma/enums";

import type { OutboxJob, OutboxRepository } from "@/lib/outbox/worker";

/**
 * Prisma-backed queue operations. The conditional update is the lease: if two
 * workers read the same due row, only one can change its status from due to
 * processing.
 */
export function createPrismaOutboxRepository(client: PrismaClient): OutboxRepository {
  return {
    async claimDue(limit, workerId, now): Promise<OutboxJob[]> {
      const claimed: OutboxJob[] = [];
      for (let index = 0; index < limit; index += 1) {
        const candidate = await client.outboundPostback.findFirst({
          where: {
            status: { in: [OutboundPostbackStatus.pending, OutboundPostbackStatus.retryable_failed] },
            nextAttemptAt: { lte: now },
          },
          orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            attemptCount: true,
            destination: true,
            requestFingerprint: true,
            correlationId: true,
            status: true,
            nextAttemptAt: true,
            conversion: {
              select: {
                eventId: true,
                eventType: true,
                valueMinor: true,
                currency: true,
                click: { select: { trackingTokens: true } },
              },
            },
            trafficSource: { select: { type: true, configuration: true, enabled: true } },
          },
        });
        if (candidate === null) {
          break;
        }

        const lease = await client.outboundPostback.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            nextAttemptAt: candidate.nextAttemptAt,
          },
          data: {
            status: OutboundPostbackStatus.processing,
            lockedAt: now,
            lockedBy: workerId,
            updatedAt: now,
          },
        });
        if (lease.count === 1) {
          claimed.push({
            id: candidate.id,
            attemptCount: candidate.attemptCount,
            destination: candidate.destination,
            requestFingerprint: candidate.requestFingerprint,
            correlationId: candidate.correlationId,
            providerId: candidate.trafficSource.enabled ? candidate.trafficSource.type : undefined,
            providerConfiguration: candidate.trafficSource.enabled ? candidate.trafficSource.configuration : undefined,
            clickTokens: candidate.conversion.click.trackingTokens as Record<string, unknown>,
            conversion: {
              eventId: candidate.conversion.eventId,
              eventType: candidate.conversion.eventType,
              valueMinor: candidate.conversion.valueMinor,
              currency: candidate.conversion.currency,
            },
          });
        }
      }
      return claimed;
    },

    async markDelivered(jobId, details) {
      await client.outboundPostback.updateMany({
        where: { id: jobId, status: OutboundPostbackStatus.processing },
        data: {
          status: OutboundPostbackStatus.delivered,
          deliveredAt: details.now,
          lastResponseStatus: details.responseStatus,
          lastResponseSummary: details.responseSummary,
          lockedAt: null,
          lockedBy: null,
          updatedAt: details.now,
        },
      });
    },

    async markRetryableFailed(jobId, details) {
      await client.outboundPostback.updateMany({
        where: { id: jobId, status: OutboundPostbackStatus.processing },
        data: {
          status: OutboundPostbackStatus.retryable_failed,
          attemptCount: details.attemptCount,
          nextAttemptAt: details.nextAttemptAt,
          lastResponseStatus: details.responseStatus,
          lastError: details.error,
          lockedAt: null,
          lockedBy: null,
          updatedAt: details.now,
        },
      });
    },

    async markPermanentlyFailed(jobId, details) {
      await client.outboundPostback.updateMany({
        where: { id: jobId, status: OutboundPostbackStatus.processing },
        data: {
          status: OutboundPostbackStatus.permanently_failed,
          attemptCount: details.attemptCount,
          lastResponseStatus: details.responseStatus,
          lastError: details.error,
          lockedAt: null,
          lockedBy: null,
          updatedAt: details.now,
        },
      });
    },
  };
}

