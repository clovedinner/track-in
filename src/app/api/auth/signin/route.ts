import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true, accountStatus: true, emailVerifiedAt: true } }) : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect.", code: "invalid_credentials" }, { status: 401 });
  }
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: "Confirm your email address before signing in.", code: "email_not_verified" }, { status: 403 });
  }
  const response = NextResponse.json({ status: "signed_in", accountStatus: user.accountStatus });
  response.cookies.set(sessionCookieName(), await createSessionToken(user), sessionCookieOptions());
  return response;
}
