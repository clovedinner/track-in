import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { createInvoice, isBillingPlan } from "@/lib/billing/service";

export async function POST(request: Request) {
  const correlationId = randomUUID();
  let user;
  try {
    user = await requireCurrentUser({ allowInactive: true });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { plan?: unknown } | null;
  if (!isBillingPlan(body?.plan)) return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  try {
    return NextResponse.json(await createInvoice(user.id, body.plan), { status: 201 });
  } catch (error) {
    console.error("[billing] invoice creation failed", {
      correlationId,
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "Unable to create invoice.", correlationId }, { status: 503 });
  }
}
