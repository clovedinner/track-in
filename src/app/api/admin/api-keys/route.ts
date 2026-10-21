import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { accountCanUseApi } from "@/lib/api/entitlements";
import { apiScopes, createApiToken } from "@/lib/api/keys";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";

export async function GET(request: Request) {
  const requestId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser({ allowInactive: true }); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), requestId); }
  const allowed = await accountCanUseApi(user.id);
  const keys = await prisma.apiKey.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return NextResponse.json({ available: allowed, scopes: apiScopes, keys }, { headers: { "x-request-id": requestId } });
}

export async function POST(request: Request) {
  const requestId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser(); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), requestId); }
  if (!await accountCanUseApi(user.id)) return apiErrorResponse(new ApiError("not_ready", 403, "Customer API access is available on Operator and Expanded plans."), requestId);
  const activeKeyCount = await prisma.apiKey.count({ where: { ownerId: user.id, revokedAt: null } });
  if (activeKeyCount >= 10) return apiErrorResponse(new ApiError("conflict", 409, "Revoke an unused key before creating another. Each account can have up to 10 active API keys."), requestId);

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be valid JSON."), requestId); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiErrorResponse(new ApiError("invalid_request", 400, "Request body must be a JSON object."), requestId);
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const mode = input.mode;
  if (!name || name.length > 100) return apiErrorResponse(new ApiError("invalid_request", 400, "Key name must be between 1 and 100 characters."), requestId);
  if (mode !== "read_only" && mode !== "full_access") return apiErrorResponse(new ApiError("invalid_request", 400, "Choose read_only or full_access access."), requestId);
  const scopes = apiScopes.filter((scope) => mode === "full_access" || scope.endsWith(":read"));
  const generated = createApiToken();

  const key = await prisma.$transaction(async (transaction) => {
    const created = await transaction.apiKey.create({
      data: { ownerId: user.id, name, prefix: generated.prefix, tokenHash: generated.tokenHash, scopes },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    });
    await transaction.auditEntry.create({
      data: { action: "api_key.created", entityType: "api_key", entityId: created.id, actor: user.email, metadata: { mode, scopeCount: scopes.length }, correlationId: requestId },
    });
    return created;
  });
  return NextResponse.json({ key, token: generated.token }, { status: 201, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}
