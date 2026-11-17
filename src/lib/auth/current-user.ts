import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/database/prisma";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getApiKeyPrincipal } from "@/lib/api/v1-context";

const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(sessionCookieName())?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, createdAt: true, accountStatus: true, timezone: true } });
});

export async function getCurrentUser() {
  return getApiKeyPrincipal() ?? getSessionUser();
}

export async function requireCurrentUser(options: { allowInactive?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");
  if (!options.allowInactive && user.accountStatus !== "active") throw new Error("Active subscription required.");
  return user;
}
