import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";

function verificationRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return verificationRedirect(request, "/auth/sign-in?verification=invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: { gt: now }, emailVerifiedAt: null },
    data: { emailVerifiedAt: now, verificationTokenHash: null, verificationTokenExpiresAt: null },
  });

  return verificationRedirect(request, result.count === 1 ? "/auth/sign-in?verified=1" : "/auth/sign-in?verification=invalid");
}
