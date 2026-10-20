import { createDecipheriv, createHmac } from "node:crypto";
import os from "node:os";

import { config } from "dotenv";

const environmentFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
config({ path: environmentFile });

const pollIntervalMs = readPositiveInteger(process.env.EMAIL_POLL_INTERVAL_MS, 5_000);
const workerId = `email-${os.hostname()}-${process.pid}`;
let stopping = false;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function messagePayload(value: unknown): { subject: string; html: string; text: string; expiresAt?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.subject !== "string" || typeof payload.html !== "string" || typeof payload.text !== "string") return null;
  return { subject: payload.subject, html: payload.html, text: payload.text, ...(typeof payload.expiresAt === "string" ? { expiresAt: payload.expiresAt } : {}) };
}

function decryptVerificationPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.encryption !== "aes-256-gcm:v1" || typeof envelope.iv !== "string" || typeof envelope.tag !== "string" || typeof envelope.data !== "string") return null;
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters to read verification email jobs.");
  const key = createHmac("sha256", secret).update("trakio-email-outbox:v1", "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64url")), decipher.final()]).toString("utf8");
  try {
    return JSON.parse(decrypted) as unknown;
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) throw new Error("RESEND_API_KEY is required to run the email worker.");
  const { prisma } = await import("@/lib/database/prisma");
  const from = process.env.EMAIL_FROM?.trim() || "Trakio <billing@trakio.org>";
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.info(`[email] worker ${workerId} started; polling every ${pollIntervalMs}ms`);

  try {
    while (!stopping) {
      const staleProcessingBefore = new Date(Date.now() - 120_000);
      const jobs = await prisma.emailOutbox.findMany({
        where: {
          OR: [
            { status: { in: ["pending", "retryable_failed"] }, nextAttemptAt: { lte: new Date() } },
            { status: "processing", updatedAt: { lte: staleProcessingBefore } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      if (jobs.length === 0) {
        await wait(pollIntervalMs);
        continue;
      }

      for (const job of jobs) {
        if (stopping) break;
        const claimed = await prisma.emailOutbox.updateMany({
          where: {
            id: job.id,
            OR: [
              { status: { in: ["pending", "retryable_failed"] }, nextAttemptAt: { lte: new Date() } },
              { status: "processing", updatedAt: { lte: staleProcessingBefore } },
            ],
          },
          data: { status: "processing", attempts: { increment: 1 } },
        });
        if (claimed.count !== 1) continue;

        const attempt = job.attempts + 1;
        let storedPayload: unknown = job.payload;
        try {
          if (job.kind === "welcome_verification") storedPayload = decryptVerificationPayload(job.payload);
        } catch (error) {
          await prisma.emailOutbox.update({ where: { id: job.id }, data: { status: "permanently_failed", payload: {}, lastError: "Unable to decrypt the verification email payload." } });
          console.error("[email] verification payload decryption failed", error instanceof Error ? error.message : "unknown error");
          continue;
        }
        const payload = messagePayload(storedPayload);
        if (!payload) {
          await prisma.emailOutbox.update({ where: { id: job.id }, data: { status: "permanently_failed", payload: {}, lastError: "Invalid stored email payload." } });
          continue;
        }
        if (payload.expiresAt && new Date(payload.expiresAt).getTime() <= Date.now()) {
          await prisma.emailOutbox.update({ where: { id: job.id }, data: { status: "suppressed", payload: {}, lastError: "Verification email expired before delivery." } });
          continue;
        }

        let httpStatus: number | null = null;
        let failure: string | null = null;
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "content-type": "application/json",
              "Idempotency-Key": job.idempotencyKey,
            },
            body: JSON.stringify({ from, to: [job.recipient], subject: payload.subject, html: payload.html, text: payload.text }),
            signal: AbortSignal.timeout(15_000),
          });
          httpStatus = response.status;
          if (!response.ok) failure = `Resend returned HTTP ${response.status}.`;
        } catch (error) {
          failure = error instanceof Error && error.name === "TimeoutError" ? "Email request timed out." : "Email provider request failed.";
        }

        if (!failure) {
          await prisma.emailOutbox.update({ where: { id: job.id }, data: { status: "delivered", payload: {}, sentAt: new Date(), lastError: null } });
          continue;
        }

        const retryable = httpStatus === null || httpStatus === 429 || httpStatus >= 500;
        if (retryable && attempt < 8) {
          const delaySeconds = Math.floor(Math.min(21_600, 5 * (2 ** (attempt - 1))) * (0.8 + Math.random() * 0.4));
          await prisma.emailOutbox.update({
            where: { id: job.id },
            data: { status: "retryable_failed", nextAttemptAt: new Date(Date.now() + delaySeconds * 1000), lastError: failure },
          });
        } else {
          await prisma.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: "permanently_failed",
              payload: job.kind === "invoice_created"
                ? { subject: payload.subject, html: payload.html, text: payload.text }
                : {},
              lastError: failure,
            },
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
    console.info(`[email] worker ${workerId} stopped`);
  }
}

void main().catch((error: unknown) => {
  console.error("[email] worker failed to start", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
