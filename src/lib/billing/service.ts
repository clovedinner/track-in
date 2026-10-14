import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";

import { prisma } from "@/lib/database/prisma";

export const BILLING_PLANS = {
  Starter: { amountMinor: 30_000, currency: "USDT" },
  Operator: { amountMinor: 50_000, currency: "USDT" },
  Expanded: { amountMinor: 100_000, currency: "USDT" },
} as const;

export type BillingPlan = keyof typeof BILLING_PLANS;

export function getBillingProvider(): string {
  return process.env.BILLING_PROVIDER?.trim() || "manual";
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
  const invoiceId = `trk_inv_${randomUUID()}`;
  const payment = await prisma.billingPayment.create({
    data: {
      userId,
      invoiceId,
      provider: getBillingProvider(),
      plan,
      amountMinor: BigInt(details.amountMinor),
      currency: details.currency,
      network: process.env.BILLING_NETWORK?.trim() || "TRC20",
    },
  });

  return {
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    plan,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    checkoutUrl: buildCheckoutUrl(payment.invoiceId),
  };
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

    const event = await transaction.billingEvent.create({ data: { userId: payment.userId, provider, eventId: input.eventId, eventType: input.eventType, payloadHash } });
    const now = new Date();

    if (input.status === "confirmed") {
      const plan = input.plan ?? (isBillingPlan(payment.plan) ? payment.plan : null);
      if (!plan) throw new BillingWebhookError("plan_required", 422);
      const start = parseDate(input.periodStart, now);
      if (!start) throw new BillingWebhookError("invalid_period", 422);
      const end = parseDate(input.periodEnd, new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000));
      const nextInvoiceAt = parseDate(input.nextInvoiceAt, end);
      if (!end || (input.nextInvoiceAt !== null && !nextInvoiceAt)) throw new BillingWebhookError("invalid_period", 422);

      const current = await transaction.subscription.findFirst({ where: { userId: payment.userId, provider, status: { in: ["active", "past_due"] } }, orderBy: { createdAt: "desc" } });
      const subscription = current
        ? await transaction.subscription.update({ where: { id: current.id }, data: { plan, status: "active", externalId: input.externalId, currentPeriodStart: start, currentPeriodEnd: end, nextInvoiceAt, canceledAt: null } })
        : await transaction.subscription.create({ data: { userId: payment.userId, plan, provider, externalId: input.externalId, currentPeriodStart: start, currentPeriodEnd: end, nextInvoiceAt, status: "active" } });

      await transaction.billingPayment.update({ where: { id: payment.id }, data: { status: "confirmed", subscriptionId: subscription.id, providerTransactionId: input.providerTransactionId, transactionHash: input.transactionHash, receivedAt: now, confirmedAt: now, failureReason: null } });
      await transaction.user.update({ where: { id: payment.userId }, data: { accountStatus: "active" } });
      await transaction.billingEvent.update({ where: { id: event.id }, data: { status: "processed", processedAt: now } });
      return { status: "accepted" as const, eventId: event.eventId, accountStatus: "active" as const };
    }

    if (input.status === "canceled" || input.status === "expired") {
      const subscription = await transaction.subscription.findFirst({ where: { userId: payment.userId, provider }, orderBy: { createdAt: "desc" } });
      if (subscription) {
        await transaction.subscription.update({ where: { id: subscription.id }, data: { status: input.status === "canceled" ? "canceled" : "expired", canceledAt: now } });
      }
      await transaction.user.update({ where: { id: payment.userId }, data: { accountStatus: input.status === "canceled" ? "canceled" : "suspended" } });
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
