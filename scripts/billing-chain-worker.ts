import os from "node:os";

import { config } from "dotenv";

const environmentFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
config({ path: environmentFile });

const pollIntervalMs = readPositiveInteger(process.env.BILLING_POLL_INTERVAL_MS, 15_000);
const workerId = `billing-${os.hostname()}-${process.pid}`;
const checkpointId = "tron-usdt-incoming-v1";
const overlapMs = 120_000;
const maxPagesPerCycle = 100;
let stopping = false;
let retryDelayMs = pollIntervalMs;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function scanConfirmedTransfers() {
  const [{ prisma }, { processBillingWebhook, hashBillingPayload, getBillingProvider, isBillingPlan }, { createTronEventId, readIncomingUsdtTransfer, TRON_USDT_CONTRACT, TRON_PAYMENT_PROVIDER }] = await Promise.all([
    import("@/lib/database/prisma"),
    import("@/lib/billing/service"),
    import("@/lib/billing/tron"),
  ]);
  const walletAddress = process.env.BILLING_WALLET_ADDRESS?.trim() ?? "";
  const apiKey = process.env.TRONGRID_API_KEY?.trim() ?? "";
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress)) throw new Error("BILLING_WALLET_ADDRESS is missing or invalid.");
  if (!apiKey) throw new Error("TRONGRID_API_KEY is required.");
  if (getBillingProvider() !== TRON_PAYMENT_PROVIDER) throw new Error("BILLING_PROVIDER must be tron.");

  const oldestInvoice = await prisma.billingPayment.findFirst({
    where: { provider: TRON_PAYMENT_PROVIDER, status: "pending", paymentAmountAtomic: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const checkpoint = await prisma.billingChainCheckpoint.upsert({
    where: { id: checkpointId },
    update: {},
    create: { id: checkpointId, lastScannedAt: oldestInvoice?.createdAt ?? new Date(Date.now() - overlapMs) },
  });
  const startTimestamp = Math.max(0, (checkpoint.lastScannedAt?.getTime() ?? Date.now() - overlapMs) - overlapMs);
  let fingerprint: string | undefined;
  let pageCount = 0;
  let matched = 0;

  do {
    pageCount += 1;
    if (pageCount > maxPagesPerCycle) throw new Error("TRON transfer scan exceeded the pagination safety limit.");
    const query = new URLSearchParams({
      only_confirmed: "true",
      only_to: "true",
      limit: "200",
      order_by: "block_timestamp,desc",
      min_timestamp: String(startTimestamp),
      contract_address: TRON_USDT_CONTRACT,
    });
    if (fingerprint) query.set("fingerprint", fingerprint);
    const response = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(walletAddress)}/transactions/trc20?${query}`, {
      headers: { accept: "application/json", "TRON-PRO-API-KEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`TronGrid returned HTTP ${response.status}.`);
    const result: unknown = await response.json();
    if (!isRecord(result) || !Array.isArray(result.data)) throw new Error("TronGrid returned an invalid transfer page.");

    for (const row of result.data) {
      const transfer = readIncomingUsdtTransfer(row, walletAddress);
      if (!transfer) continue;
      const eventId = createTronEventId(transfer);
      const ingested = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw<{ locked: number }[]>`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext('trakio:billing:tron-usdt-amount'))
          )
          SELECT 1 AS locked FROM lock
        `;
        const insertResult = await transaction.billingChainTransfer.createMany({
          data: {
            id: eventId,
            transactionHash: transfer.transaction_id,
            amountAtomic: BigInt(transfer.value),
            fromAddress: transfer.from,
            toAddress: transfer.to,
            blockTimestamp: new Date(transfer.block_timestamp),
          },
          skipDuplicates: true,
        });
        const transferRecord = await transaction.billingChainTransfer.findUnique({ where: { id: eventId } });
        if (!transferRecord) throw new Error("Unable to persist the confirmed TRON transfer.");
        const payment = await transaction.billingPayment.findUnique({ where: { paymentAmountAtomic: transferRecord.amountAtomic } });
        return { isNew: insertResult.count === 1, transferRecord, payment };
      });
      if (!ingested.payment) {
        if (ingested.isNew) console.warn(`[billing] unmatched confirmed USDT transfer recorded: tx=${transfer.transaction_id.slice(0, 12)} amount=${transfer.value}`);
        continue;
      }
      const payment = ingested.payment;
      if (payment.provider !== TRON_PAYMENT_PROVIDER || payment.currency !== "USDT" || payment.network !== "TRC20") continue;
      if (ingested.transferRecord.paymentId) continue;
      if (ingested.transferRecord.blockTimestamp.getTime() < payment.createdAt.getTime()) {
        if (ingested.isNew) console.warn(`[billing] pre-invoice USDT transfer left unmatched: tx=${transfer.transaction_id.slice(0, 12)} invoice=${payment.invoiceId}`);
        continue;
      }
      if (payment.status !== "pending") {
        if (payment.status === "confirmed" && payment.transactionHash === transfer.transaction_id) {
          await prisma.billingChainTransfer.update({ where: { id: eventId }, data: { paymentId: payment.id } });
        }
        continue;
      }
      if (payment.isTest) {
        if (!process.env.BILLING_TEST_USER_ID?.trim() || payment.userId !== process.env.BILLING_TEST_USER_ID.trim()) {
          console.error(`[billing] test invoice is not assigned to the configured test account; leaving transfer unmatched invoice=${payment.invoiceId}`);
          continue;
        }
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const accepted = await processBillingWebhook(TRON_PAYMENT_PROVIDER, {
          eventId,
          eventType: "usdt_test_transfer_confirmed",
          invoiceId: payment.invoiceId,
          status: "confirmed",
          plan: "Starter",
          providerTransactionId: transfer.transaction_id,
          transactionHash: transfer.transaction_id,
          amountMinor: Number(payment.amountMinor),
          currency: "USDT",
          periodStart: now.toISOString(),
          periodEnd: periodEnd.toISOString(),
          nextInvoiceAt: periodEnd.toISOString(),
        }, hashBillingPayload(JSON.stringify(transfer)));
        if (accepted.status === "accepted") {
          await prisma.billingChainTransfer.update({ where: { id: eventId }, data: { paymentId: payment.id } });
          matched += 1;
          console.info(`[billing] test transfer confirmed; Starter activated for 30 days invoice=${payment.invoiceId} tx=${transfer.transaction_id.slice(0, 12)}`);
        }
        continue;
      }
      if (!isBillingPlan(payment.plan)) {
        console.error(`[billing] invoice ${payment.invoiceId} has an unsupported stored plan; transfer left for review`);
        continue;
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const accepted = await processBillingWebhook(TRON_PAYMENT_PROVIDER, {
        eventId,
        eventType: "usdt_transfer_confirmed",
        invoiceId: payment.invoiceId,
        status: "confirmed",
        plan: payment.plan,
        providerTransactionId: transfer.transaction_id,
        transactionHash: transfer.transaction_id,
        amountMinor: Number(payment.amountMinor),
        currency: "USDT",
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
        nextInvoiceAt: periodEnd.toISOString(),
      }, hashBillingPayload(JSON.stringify(transfer)));
      if (accepted.status === "accepted") {
        await prisma.billingChainTransfer.update({ where: { id: eventId }, data: { paymentId: payment.id } });
        matched += 1;
      }
    }

    const meta = isRecord(result.meta) ? result.meta : null;
    fingerprint = meta && typeof meta.fingerprint === "string" && meta.fingerprint ? meta.fingerprint : undefined;
  } while (fingerprint);

  await prisma.billingChainCheckpoint.update({ where: { id: checkpointId }, data: { lastScannedAt: new Date(Date.now() - 60_000) } });
  if (matched) console.info(`[billing] worker=${workerId} confirmed=${matched} transfer(s)`);
}

async function main() {
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.info(`[billing] chain monitor ${workerId} started; polling every ${pollIntervalMs}ms`);
  try {
    while (!stopping) {
      let delayMs = pollIntervalMs;
      try {
        await scanConfirmedTransfers();
        retryDelayMs = pollIntervalMs;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error(`[billing] chain scan failed: ${message}`);
        delayMs = retryDelayMs + Math.floor(Math.random() * Math.max(1, retryDelayMs / 4));
        retryDelayMs = Math.min(retryDelayMs * 2, 15 * 60 * 1000);
      }
      if (!stopping) await wait(delayMs);
    }
  } finally {
    const { prisma } = await import("@/lib/database/prisma");
    await prisma.$disconnect();
    console.info(`[billing] chain monitor ${workerId} stopped`);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[billing] chain monitor failed to start: ${message}`);
  process.exitCode = 1;
});
