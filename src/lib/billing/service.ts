import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";

import { prisma } from "@/lib/database/prisma";
import { MAX_INVOICE_REFERENCE_ATOMIC, TRON_PAYMENT_PROVIDER, toUsdtAtomicFromCents } from "@/lib/billing/tron";
import { canUseBillingTestMode } from "@/lib/billing/test-access";
import { queueInvoiceEmail } from "@/lib/email/outbox";
import { NOWPAYMENTS_PAY_CURRENCY, NOWPAYMENTS_PROVIDER, buildNowPaymentsInvoiceRequest, isNowPaymentsInvoiceUrl, parseUsdCents } from "@/lib/billing/nowpayments";

export const BILLING_PLANS = {
  Starter: { amountMinor: 30_000, currency: "USDT" },
  Operator: { amountMinor: 50_000, currency: "USDT" },
  Expanded: { amountMinor: 100_000, currency: "USDT" },
} as const;

export type BillingPlan = keyof typeof BILLING_PLANS;

export function getBillingProvider(): string {
  return process.env.BILLING_PROVIDER?.trim() || TRON_PAYMENT_PROVIDER;
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === "string" && value in BILLING_PLANS;
}

export function createWebhookSignature(secret: string, timestamp: string, payload: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
}

export function verifyWebhookSignature(secret: string, timestamp: string, payload: string, signature: string): boolean {
  const expected = createWebhookSignature(secret, timestamp, payload);
  const provided = signature.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}

export function hashBillingPayload(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildCheckoutUrl(invoiceId: string): string | null {
  const configured = process.env.BILLING_CHECKOUT_URL?.trim();
  if (!configured) return null;
  const url = new URL(configured);
  url.searchParams.set("invoice_id", invoiceId);
  return url.toString();
}

export async function createInvoice(userId: string, plan: BillingPlan) {
  const details = BILLING_PLANS[plan];
  const provider = getBillingProvider();
  if (provider === NOWPAYMENTS_PROVIDER) return createNowPaymentsInvoice(userId, plan, details.amountMinor);
  if (provider !== TRON_PAYMENT_PROVIDER) throw new Error("BILLING_PROVIDER must be tron or nowpayments.");
  const walletAddress = process.env.BILLING_WALLET_ADDRESS?.trim() ?? "";
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress)) throw new Error("BILLING_WALLET_ADDRESS is missing or invalid.");
  if (!process.env.TRONGRID_API_KEY?.trim()) throw new Error("TRONGRID_API_KEY is required for automatic payment verification.");
  const amountMinor = BigInt(details.amountMinor);
  const existing = await prisma.billingPayment.findFirst({
    where: { userId, plan, status: "pending", currency: details.currency, paymentAmountAtomic: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  const payment = existing ?? await createUniquelyPricedPayment({ userId, plan, provider, currency: details.currency, amountMinor });

  return {
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    plan,
    amountMinor: payment.amountMinor.toString(),
    paymentAmountAtomic: payment.paymentAmountAtomic?.toString() ?? null,
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    walletAddress,
    checkoutUrl: buildCheckoutUrl(payment.invoiceId),
  };
}

async function createNowPaymentsInvoice(userId: string, plan: string, amountMinor: number, isTest = false) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY is required to create hosted invoices.");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to create hosted invoices.");
  const origin = new URL(appUrl);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");

  const existing = await prisma.billingPayment.findFirst({
    where: { userId, plan, provider: NOWPAYMENTS_PROVIDER, status: "pending", currency: "USD", customerPaysFees: true, isTest },
    orderBy: { createdAt: "desc" },
  });
  let payment = existing;
  if (!payment) {
    payment = await prisma.billingPayment.create({
      data: {
        userId,
        invoiceId: `${isTest ? "trk_test" : "trk_inv"}_${randomUUID()}`,
        provider: NOWPAYMENTS_PROVIDER,
        customerPaysFees: true,
        isTest,
        plan,
        amountMinor: BigInt(amountMinor),
        currency: "USD",
        network: "TRC20",
      },
    });
  }

  if (!payment.checkoutUrl || !payment.providerInvoiceId) {
    const callbackUrl = new URL("/api/billing/nowpayments", origin).toString();
    const successUrl = new URL("/payment-done", origin);
    successUrl.searchParams.set("invoice_id", payment.invoiceId);
    const cancelUrl = new URL("/admin/subscribe?payment=cancelled", origin).toString();
    let response: Response;
    try {
      response = await fetch("https://api.nowpayments.io/v1/invoice", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(buildNowPaymentsInvoiceRequest({
          amountMinor,
          callbackUrl,
          invoiceId: payment.invoiceId,
          plan,
          successUrl: successUrl.toString(),
          cancelUrl,
        })),
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      await prisma.billingPayment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "NOWPayments invoice request failed" } });
      throw new Error("Unable to reach NOWPayments. Please try again.");
    }
    const responseBody: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(responseBody) || !isNowPaymentsInvoiceUrl(responseBody.invoice_url) || (typeof responseBody.id !== "string" && typeof responseBody.id !== "number")) {
      await prisma.billingPayment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "NOWPayments rejected invoice request" } });
      throw new Error("NOWPayments could not create this invoice. Check your merchant account and try again.");
    }
    const providerInvoiceId = String(responseBody.id);
    const checkoutUrl = responseBody.invoice_url;
    payment = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.billingPayment.update({ where: { id: payment!.id }, data: { providerInvoiceId, checkoutUrl } });
      await queueInvoiceEmail(transaction, {
        userId,
        invoiceId: updated.invoiceId,
        plan,
        currency: "USD",
        amountMinor: updated.amountMinor,
        network: "USDT on TRC20",
        checkoutUrl,
      });
      return updated;
    });
  }

  return {
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    plan,
    amountMinor: payment.amountMinor.toString(),
    paymentAmountAtomic: null,
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    isTest: payment.isTest,
    walletAddress: "",
    checkoutUrl: payment.checkoutUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TEST_PAYMENT_AMOUNT_ATOMIC = BigInt(100_000);

export async function createBillingTestInvoice(userId: string) {
  if (!canUseBillingTestMode(userId)) {
    throw new Error("Payment monitor tests are unavailable for this account.");
  }
  if (getBillingProvider() === NOWPAYMENTS_PROVIDER) return createNowPaymentsTestInvoice(userId);
  if (getBillingProvider() !== TRON_PAYMENT_PROVIDER) throw new Error("Payment monitor tests require a supported payment provider.");
  const walletAddress = process.env.BILLING_WALLET_ADDRESS?.trim() ?? "";
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress)) throw new Error("BILLING_WALLET_ADDRESS is missing or invalid.");
  if (!process.env.TRONGRID_API_KEY?.trim()) throw new Error("TRONGRID_API_KEY is required for automatic payment verification.");

  const payment = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<{ locked: number }[]>`
      WITH lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtext('trakio:billing:tron-usdt-amount'))
      )
      SELECT 1 AS locked FROM lock
    `;
    const pendingTest = await transaction.billingPayment.findFirst({
      where: { isTest: true, status: "pending", paymentAmountAtomic: TEST_PAYMENT_AMOUNT_ATOMIC },
      orderBy: { createdAt: "desc" },
    });
    if (pendingTest) {
      if (pendingTest.userId !== userId) throw new Error("A test payment is already pending. Finish it before creating another.");
      return pendingTest;
    }
    const completedTest = await transaction.billingPayment.findFirst({
      where: { userId, isTest: true, status: "confirmed" },
      select: { id: true },
    });
    if (completedTest) throw new Error("The payment monitor test has already been completed for this account.");
    const activeSubscription = await transaction.subscription.findFirst({
      where: { userId, status: { in: ["active", "past_due"] } },
      select: { id: true },
    });
    if (activeSubscription) throw new Error("A test invoice requires a dedicated account without an active subscription.");

    return transaction.billingPayment.create({
      data: {
        userId,
        invoiceId: `trk_test_${randomUUID()}`,
        provider: TRON_PAYMENT_PROVIDER,
        plan: "Payment monitor test",
        isTest: true,
        amountMinor: BigInt(10),
        paymentAmountAtomic: TEST_PAYMENT_AMOUNT_ATOMIC,
        currency: "USDT",
        network: "TRC20",
      },
    });
  });

  return {
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    plan: payment.plan,
    isTest: true,
    amountMinor: payment.amountMinor.toString(),
    paymentAmountAtomic: payment.paymentAmountAtomic?.toString() ?? null,
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    walletAddress,
    checkoutUrl: null,
  };
}

const NOWPAYMENTS_TEST_AMOUNT_MINOR = 2_000;

async function createNowPaymentsTestInvoice(userId: string) {
  const payment = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<{ locked: number }[]>`
      WITH lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtext(${`trakio:billing:nowpayments-test:${userId}`}))
      )
      SELECT 1 AS locked FROM lock
    `;
    const pendingTest = await transaction.billingPayment.findFirst({
      where: { userId, provider: NOWPAYMENTS_PROVIDER, isTest: true, plan: "Payment monitor test", status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (pendingTest) return pendingTest;

    const completedTest = await transaction.billingPayment.findFirst({
      where: { userId, isTest: true, status: "confirmed" },
      select: { id: true },
    });
    if (completedTest) throw new Error("The payment monitor test has already been completed for this account.");

    const activeSubscription = await transaction.subscription.findFirst({
      where: { userId, status: { in: ["active", "past_due"] } },
      select: { id: true },
    });
    if (activeSubscription) throw new Error("A test invoice requires a dedicated account without an active subscription.");

    await transaction.billingPayment.updateMany({
      where: { userId, provider: TRON_PAYMENT_PROVIDER, isTest: true, status: "pending" },
      data: { status: "failed", failureReason: "Replaced with a NOWPayments test invoice" },
    });

    return transaction.billingPayment.create({
      data: {
        userId,
        invoiceId: `trk_test_${randomUUID()}`,
        provider: NOWPAYMENTS_PROVIDER,
        customerPaysFees: true,
        plan: "Payment monitor test",
        isTest: true,
        amountMinor: BigInt(NOWPAYMENTS_TEST_AMOUNT_MINOR),
        currency: "USD",
        network: "TRC20",
      },
    });
  });

  return createNowPaymentsInvoice(userId, payment.plan, Number(payment.amountMinor), true);
}

async function createUniquelyPricedPayment(input: { userId: string; plan: BillingPlan; provider: string; currency: string; amountMinor: bigint }) {
  const baseAtomic = toUsdtAtomicFromCents(input.amountMinor);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw<{ locked: number }[]>`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext('trakio:billing:tron-usdt-amount'))
          )
          SELECT 1 AS locked FROM lock
        `;
        const previous = await transaction.billingPayment.aggregate({
          where: { currency: input.currency, amountMinor: input.amountMinor, paymentAmountAtomic: { not: null } },
          _max: { paymentAmountAtomic: true },
        });
        let candidate = previous._max.paymentAmountAtomic === null ? baseAtomic + BigInt(1) : previous._max.paymentAmountAtomic + BigInt(1);
        const upperBound = baseAtomic + MAX_INVOICE_REFERENCE_ATOMIC;
        while (candidate <= upperBound) {
          const usedByIncomingTransfer = await transaction.billingChainTransfer.findFirst({ where: { amountAtomic: candidate }, select: { id: true } });
          if (usedByIncomingTransfer) {
            candidate += BigInt(1);
            continue;
          }
          const payment = await transaction.billingPayment.create({
            data: {
              userId: input.userId,
              invoiceId: `trk_inv_${randomUUID()}`,
              provider: input.provider,
              plan: input.plan,
              amountMinor: input.amountMinor,
              paymentAmountAtomic: candidate,
              currency: input.currency,
              network: process.env.BILLING_NETWORK?.trim() || "TRC20",
            },
          });
          await queueInvoiceEmail(transaction, {
            userId: input.userId,
            invoiceId: payment.invoiceId,
            plan: input.plan,
            currency: input.currency,
            amountMinor: payment.amountMinor,
            paymentAmountAtomic: candidate,
            network: payment.network ?? "TRC20",
            walletAddress: process.env.BILLING_WALLET_ADDRESS?.trim() ?? "",
          });
          return payment;
        }
        throw new Error("This plan has reached its unique payment-reference limit. Increase MAX_INVOICE_REFERENCE_ATOMIC before issuing another invoice.");
      });
    } catch (error) {
      if (!hasPrismaErrorCode(error, "P2002") || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to allocate a unique payment amount.");
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

type WebhookInput = {
  eventId: string;
  eventType: string;
  invoiceId: string;
  status: "confirmed" | "failed" | "refunded" | "canceled" | "expired";
  plan?: BillingPlan;
  externalId?: string;
  providerTransactionId?: string;
  transactionHash?: string;
  periodStart?: string;
  periodEnd?: string | null;
  nextInvoiceAt?: string | null;
  amountMinor?: number;
  currency?: string;
  failureReason?: string;
};

export async function processNowPaymentsWebhook(value: unknown, payloadHash: string) {
  if (!isRecord(value)) throw new BillingWebhookError("invalid_payload", 400);
  const invoiceId = typeof value.order_id === "string" ? value.order_id.trim() : "";
  const providerInvoiceId = String(value.invoice_id ?? "").trim();
  const paymentId = typeof value.payment_id === "string" || typeof value.payment_id === "number" ? String(value.payment_id).trim() : "";
  const paymentStatus = typeof value.payment_status === "string" ? value.payment_status.trim().toLowerCase() : "";
  const priceCurrency = typeof value.price_currency === "string" ? value.price_currency.trim().toUpperCase() : "";
  const payCurrency = typeof value.pay_currency === "string" ? value.pay_currency.trim().toLowerCase() : "";
  const amountMinor = parseUsdCents(value.price_amount);
  if (!invoiceId || invoiceId.length > 128 || !providerInvoiceId || providerInvoiceId.length > 128 || !paymentId || paymentId.length > 100 || !paymentStatus || !amountMinor) {
    throw new BillingWebhookError("invalid_payload", 400);
  }
  const payment = await prisma.billingPayment.findUnique({ where: { invoiceId } });
  if (!payment || payment.provider !== NOWPAYMENTS_PROVIDER) throw new BillingWebhookError("invoice_not_found", 404);
  if (payment.providerInvoiceId !== providerInvoiceId) throw new BillingWebhookError("invoice_mismatch", 422);
  if (priceCurrency !== "USD" || payment.currency !== "USD" || amountMinor !== Number(payment.amountMinor)) throw new BillingWebhookError("amount_mismatch", 422);
  if (payCurrency !== NOWPAYMENTS_PAY_CURRENCY) throw new BillingWebhookError("currency_mismatch", 422);

  const statusByProvider: Record<string, WebhookInput["status"] | undefined> = {
    finished: "confirmed",
    failed: "failed",
    expired: "expired",
    refunded: "refunded",
  };
  const status = statusByProvider[paymentStatus];
  if (!status) return { status: "pending" as const };

  const transactionHash = typeof value.payin_hash === "string" ? value.payin_hash.trim().slice(0, 256) : undefined;
  return processBillingWebhook(NOWPAYMENTS_PROVIDER, {
    eventId: `${paymentId}:${paymentStatus}`,
    eventType: `nowpayments.${paymentStatus}`,
    invoiceId,
    status,
    plan: isBillingPlan(payment.plan) ? payment.plan : undefined,
    externalId: providerInvoiceId,
    providerTransactionId: paymentId,
    transactionHash,
    amountMinor,
    currency: "USD",
  }, payloadHash);
}

function parseDate(value: string | null | undefined, fallback: Date | null): Date | null {
  if (value === null) return null;
  if (value === undefined) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function processBillingWebhook(provider: string, input: WebhookInput, payloadHash: string) {
  return prisma.$transaction(async (transaction) => {
    const existingEvent = await transaction.billingEvent.findUnique({ where: { provider_eventId: { provider, eventId: input.eventId } } });
    if (existingEvent) return { status: "duplicate" as const, eventId: existingEvent.eventId };

    const payment = await transaction.billingPayment.findUnique({ where: { invoiceId: input.invoiceId } });
    if (!payment || payment.provider !== provider) throw new BillingWebhookError("invoice_not_found", 404);
    if (input.amountMinor !== undefined && input.amountMinor !== Number(payment.amountMinor)) throw new BillingWebhookError("amount_mismatch", 422);
    if (input.currency !== undefined && input.currency.toUpperCase() !== payment.currency) throw new BillingWebhookError("currency_mismatch", 422);
    if (payment.status === "confirmed") return { status: "duplicate" as const, eventId: input.eventId };

    const event = await transaction.billingEvent.create({ data: { userId: payment.userId, provider, eventId: input.eventId, eventType: input.eventType, payloadHash } });
    const now = new Date();

    if (input.status === "confirmed") {
      const plan = input.plan ?? (payment.isTest ? "Starter" : isBillingPlan(payment.plan) ? payment.plan : null);
      if (!plan) throw new BillingWebhookError("plan_required", 422);
      const start = parseDate(input.periodStart, now);
      if (!start) throw new BillingWebhookError("invalid_period", 422);
      const end = parseDate(input.periodEnd, new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000));
      const nextInvoiceAt = parseDate(input.nextInvoiceAt, end);
      if (!end || (input.nextInvoiceAt !== null && !nextInvoiceAt)) throw new BillingWebhookError("invalid_period", 422);

      const current = await transaction.subscription.findFirst({ where: { userId: payment.userId, status: { in: ["active", "past_due"] } }, orderBy: { createdAt: "desc" } });
      if (payment.isTest && current) throw new BillingWebhookError("test_account_already_subscribed", 409);
      const subscription = current
        ? await transaction.subscription.update({ where: { id: current.id }, data: { plan, status: "active", provider, externalId: input.externalId, currentPeriodStart: start, currentPeriodEnd: end, nextInvoiceAt, canceledAt: null } })
        : await transaction.subscription.create({ data: { userId: payment.userId, plan, provider, externalId: input.externalId, currentPeriodStart: start, currentPeriodEnd: end, nextInvoiceAt, status: "active" } });

      await transaction.billingPayment.update({ where: { id: payment.id }, data: { status: "confirmed", subscriptionId: subscription.id, paymentAmountAtomic: payment.isTest ? null : undefined, providerTransactionId: input.providerTransactionId, transactionHash: input.transactionHash, receivedAt: now, confirmedAt: now, failureReason: null } });
      await transaction.user.update({ where: { id: payment.userId }, data: { accountStatus: "active" } });
      await transaction.billingEvent.update({ where: { id: event.id }, data: { status: "processed", processedAt: now } });
      return { status: "accepted" as const, eventId: event.eventId, accountStatus: "active" as const };
    }

    const paymentStatus = input.status === "refunded" ? "refunded" : "failed";
    await transaction.billingPayment.update({ where: { id: payment.id }, data: { status: paymentStatus, failureReason: input.failureReason ?? input.status, providerTransactionId: input.providerTransactionId, transactionHash: input.transactionHash } });
    await transaction.billingEvent.update({ where: { id: event.id }, data: { status: "processed", processedAt: now } });
    return { status: "accepted" as const, eventId: event.eventId, paymentStatus };
  });
}

export class BillingWebhookError extends Error {
  public constructor(public readonly code: string, public readonly httpStatus: number) {
    super(code);
    this.name = "BillingWebhookError";
  }
}

export function safeWebhookInput(value: unknown): WebhookInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
  const eventType = typeof body.event_type === "string" ? body.event_type.trim() : "";
  const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id.trim() : "";
  const status = body.status;
  if (!eventId || eventId.length > 128 || !eventType || eventType.length > 128 || !invoiceId || invoiceId.length > 128 || !["confirmed", "failed", "refunded", "canceled", "expired"].includes(String(status))) return null;
  const plan = body.plan === undefined ? undefined : isBillingPlan(body.plan) ? body.plan : undefined;
  if (body.plan !== undefined && !plan) return null;
  const amountMinor = body.amount_minor === undefined ? undefined : typeof body.amount_minor === "number" && Number.isSafeInteger(body.amount_minor) && body.amount_minor >= 0 ? body.amount_minor : undefined;
  if (body.amount_minor !== undefined && amountMinor === undefined) return null;
  return { eventId, eventType, invoiceId, status: status as WebhookInput["status"], plan, externalId: typeof body.external_id === "string" ? body.external_id.trim() || undefined : undefined, providerTransactionId: typeof body.provider_transaction_id === "string" ? body.provider_transaction_id.trim() || undefined : undefined, transactionHash: typeof body.transaction_hash === "string" ? body.transaction_hash.trim() || undefined : undefined, periodStart: typeof body.period_start === "string" ? body.period_start : undefined, periodEnd: body.period_end === null ? null : typeof body.period_end === "string" ? body.period_end : undefined, nextInvoiceAt: body.next_invoice_at === null ? null : typeof body.next_invoice_at === "string" ? body.next_invoice_at : undefined, amountMinor, currency: typeof body.currency === "string" ? body.currency.trim().toUpperCase() : undefined, failureReason: typeof body.failure_reason === "string" ? body.failure_reason.slice(0, 500) : undefined };
}
