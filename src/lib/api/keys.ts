import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/database/prisma";
import type { ApiKeyPrincipal } from "@/lib/api/v1-context";

export const apiScopes = [
  "campaigns:read", "campaigns:write",
  "offers:read", "offers:write",
  "traffic_sources:read", "traffic_sources:write",
  "conversions:read", "conversions:write",
  "analytics:read",
  "delivery:read", "delivery:retry",
  "profile:read", "profile:write",
] as const;

export type ApiScope = (typeof apiScopes)[number];

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createApiToken() {
  const prefix = `tk_live_${randomBytes(6).toString("hex")}`;
  const token = `${prefix}_${randomBytes(32).toString("base64url")}`;
  return { prefix, token, tokenHash: hashApiToken(token) };
}

export async function authenticateApiToken(request: Request): Promise<{
  principal: ApiKeyPrincipal;
  scopes: ApiScope[];
  keyId: string;
} | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  const match = /^(tk_live_[a-f0-9]{12})_([A-Za-z0-9_-]{40,})$/.exec(token);
  if (!match) return null;

  const key = await prisma.apiKey.findUnique({
    where: { prefix: match[1] },
    select: { id: true, ownerId: true, tokenHash: true, scopes: true, revokedAt: true, lastUsedAt: true },
  });
  if (!key || key.revokedAt) return null;
  const supplied = Buffer.from(hashApiToken(token), "hex");
  const stored = Buffer.from(key.tokenHash, "hex");
  if (supplied.length !== stored.length || !timingSafeEqual(supplied, stored)) return null;

  const user = await prisma.user.findUnique({
    where: { id: key.ownerId },
    select: { id: true, email: true, createdAt: true, accountStatus: true, timezone: true },
  });
  if (!user || user.accountStatus !== "active") return null;
  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "active", plan: { in: ["Operator", "Expanded"] } },
    select: { id: true },
  });
  if (!subscription) return null;

  const lastUsedThreshold = new Date(Date.now() - 5 * 60_000);
  if (!key.lastUsedAt || key.lastUsedAt < lastUsedThreshold) await prisma.apiKey.updateMany({
    where: { id: key.id, revokedAt: null, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: lastUsedThreshold } }] },
    data: { lastUsedAt: new Date() },
  });

  return {
    principal: user,
    scopes: key.scopes.filter((scope): scope is ApiScope => apiScopes.includes(scope as ApiScope)),
    keyId: key.id,
  };
}
