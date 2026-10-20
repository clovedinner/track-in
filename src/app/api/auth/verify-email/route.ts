import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";

function verificationRedirect(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return NextResponse.redirect(new URL(path, appUrl), {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return verificationRedirect("/auth/sign-in?verification=invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: { gt: now }, emailVerifiedAt: null },
    data: { emailVerifiedAt: now, verificationTokenHash: null, verificationTokenExpiresAt: null },
  });

  return verificationRedirect(result.count === 1 ? "/auth/sign-in?verified=1" : "/auth/sign-in?verification=invalid");
}
