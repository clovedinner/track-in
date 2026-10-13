import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { hashPassword, normalizeEmail, validatePassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const passwordError = validatePassword(body?.password);
  if (!email || passwordError) return NextResponse.json({ error: !email ? "Enter a valid email address." : passwordError }, { status: 400 });
  const password = body?.password as string;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password) }, select: { id: true, email: true } });
  const response = NextResponse.json({ status: "created" }, { status: 201 });
  response.cookies.set(sessionCookieName(), await createSessionToken(user), sessionCookieOptions());
  return response;
}
