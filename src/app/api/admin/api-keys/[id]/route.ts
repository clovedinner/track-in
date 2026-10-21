import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { getCorrelationId } from "@/lib/observability/correlation-id";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getCorrelationId(request);
  let user;
  try { user = await requireCurrentUser({ allowInactive: true }); }
  catch { return apiErrorResponse(new ApiError("unauthorized", 401, "Authentication required."), requestId); }
  const { id } = await context.params;
  const key = await prisma.apiKey.findFirst({ where: { id, ownerId: user.id }, select: { id: true, revokedAt: true } });
  if (!key) return apiErrorResponse(new ApiError("not_found", 404, "API key not found."), requestId);
  if (!key.revokedAt) {
    await prisma.$transaction(async (transaction) => {
      await transaction.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await transaction.auditEntry.create({
        data: { action: "api_key.revoked", entityType: "api_key", entityId: id, actor: user.email, metadata: {}, correlationId: requestId },
      });
    });
  }
  return NextResponse.json({ revoked: true }, { headers: { "x-request-id": requestId } });
}
