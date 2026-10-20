import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/database/prisma";
import { hashPassword, normalizeEmail, validatePassword } from "@/lib/auth/password";
import { queueWelcomeVerificationEmail } from "@/lib/email/outbox";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const passwordError = validatePassword(body?.password);
  if (!email || passwordError) return NextResponse.json({ error: !email ? "Enter a valid email address." : passwordError }, { status: 400 });
  const password = body?.password as string;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({ data: { email, passwordHash: await hashPassword(password) }, select: { id: true, email: true } });
      await queueWelcomeVerificationEmail(transaction, created, token, tokenHash, expiresAt);
      return created;
    });
    return NextResponse.json({ status: "verification_required", email: user.email }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("[auth] signup failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 503 });
  }
}
