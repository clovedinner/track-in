import { createCipheriv, createHmac, randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";

type EmailMessage = {
  subject: string;
  html: string;
  text: string;
  expiresAt?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function emailPayloadKey(): Buffer {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters to protect verification email links.");
  return createHmac("sha256", secret).update("trakio-email-outbox:v1", "utf8").digest();
}

function encryptVerificationMessage(message: EmailMessage): Prisma.InputJsonObject {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", emailPayloadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(message), "utf8"), cipher.final()]);
  return {
    encryption: "aes-256-gcm:v1",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  };
}

export async function queueEmail(
  transaction: Prisma.TransactionClient,
  input: { kind: string; recipient: string; idempotencyKey: string; message: EmailMessage },
) {
  return transaction.emailOutbox.create({
    data: {
      kind: input.kind,
      recipient: input.recipient,
      idempotencyKey: input.idempotencyKey,
      payload: input.kind === "welcome_verification" ? encryptVerificationMessage(input.message) : input.message,
    },
  });
}

export async function queueWelcomeVerificationEmail(
  transaction: Prisma.TransactionClient,
  user: { id: string; email: string },
  token: string,
  tokenHash: string,
  expiresAt: Date,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const verificationUrl = new URL("/api/auth/verify-email", appUrl);
  verificationUrl.searchParams.set("token", token);
  const safeEmail = escapeHtml(user.email);
  const safeUrl = escapeHtml(verificationUrl.toString());

  await transaction.user.update({
    where: { id: user.id },
    data: {
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
      verificationEmailSentAt: new Date(),
    },
  });
  await queueEmail(transaction, {
    kind: "welcome_verification",
    recipient: user.email,
    idempotencyKey: `welcome-verification:${user.id}:${tokenHash}`,
    message: {
      subject: "Confirm your Trakio account",
      expiresAt: expiresAt.toISOString(),
      text: `Welcome to Trakio. Confirm your email address to continue setting up your account: ${verificationUrl.toString()}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;color:#121212;max-width:560px;margin:32px auto;padding:24px;border:2px solid #121212"><p style="color:#D02020;font-weight:bold">TRAKIO</p><h1>Welcome to Trakio.</h1><p>Confirm <strong>${safeEmail}</strong> to finish setting up your account and choose a subscription.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#1040C0;color:#fff;padding:14px 20px;text-decoration:none;font-weight:bold">Confirm email</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p></div>`,
    },
  });
}

export async function queueInvoiceEmail(
  transaction: Prisma.TransactionClient,
  input: {
    userId: string;
    invoiceId: string;
    plan: string;
    currency: string;
    paymentAmountAtomic: bigint;
    network: string;
    walletAddress: string;
  },
) {
  const user = await transaction.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (!user) throw new Error("Invoice owner was not found.");

  const atomicScale = BigInt(1_000_000);
  const amount = `${input.paymentAmountAtomic / atomicScale}.${(input.paymentAmountAtomic % atomicScale).toString().padStart(6, "0")} ${input.currency}`;
  const safe = {
    plan: escapeHtml(input.plan),
    amount: escapeHtml(amount),
    invoiceId: escapeHtml(input.invoiceId),
    network: escapeHtml(input.network),
    walletAddress: escapeHtml(input.walletAddress),
  };
  await queueEmail(transaction, {
    kind: "invoice_created",
    recipient: user.email,
    idempotencyKey: `invoice:${input.invoiceId}`,
    message: {
      subject: `Your Trakio ${input.plan} invoice`,
      text: `Invoice ${input.invoiceId}\nPlan: ${input.plan}\nAmount: ${amount}\nNetwork: ${input.network}\nWallet: ${input.walletAddress}\n\nSend the exact amount on the listed network. Your subscription activates after payment is confirmed.`,
      html: `<div style="font-family:Arial,sans-serif;color:#121212;max-width:560px;margin:32px auto;padding:24px;border:2px solid #121212"><p style="color:#D02020;font-weight:bold">TRAKIO</p><h1>Your invoice is ready.</h1><p>Invoice <strong>${safe.invoiceId}</strong></p><p>Plan: <strong>${safe.plan}</strong></p><p style="font-size:24px;font-weight:bold">${safe.amount}</p><p>Network: ${safe.network}</p><p>Wallet: <code style="word-break:break-all">${safe.walletAddress}</code></p><p>Send the exact amount on the listed network. Your subscription activates after payment is confirmed.</p></div>`,
    },
  });
}
