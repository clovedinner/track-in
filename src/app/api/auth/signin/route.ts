import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } }) : null;
  if (!user) {
    return NextResponse.json({ error: "Account not found. Please sign up first.", code: "account_not_found" }, { status: 401 });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect password.", code: "invalid_password" }, { status: 401 });
  }
  const response = NextResponse.json({ status: "signed_in" });
  response.cookies.set(sessionCookieName(), await createSessionToken(user), sessionCookieOptions());
  return response;
}
