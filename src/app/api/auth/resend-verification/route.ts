import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/database/prisma";
import { queueWelcomeVerificationEmail } from "@/lib/email/outbox";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ status: "accepted" });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true, verificationEmailSentAt: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash)) || user.emailVerifiedAt) {
    return NextResponse.json({ status: "accepted" });
  }

  const now = new Date();
  const resendAvailableAt = user.verificationEmailSentAt ? user.verificationEmailSentAt.getTime() + 60_000 : 0;
  if (resendAvailableAt > now.getTime()) {
    return NextResponse.json({ status: "accepted", retryAfterSeconds: Math.ceil((resendAvailableAt - now.getTime()) / 1000) });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await prisma.$transaction(async (transaction) => {
    await transaction.emailOutbox.updateMany({
      where: { recipient: user.email, kind: "welcome_verification", status: { in: ["pending", "retryable_failed"] } },
      data: { status: "suppressed", payload: {}, lastError: "Replaced by a newer verification email." },
    });
    await queueWelcomeVerificationEmail(transaction, user, token, tokenHash, expiresAt);
  });

  return NextResponse.json({ status: "accepted" });
}
