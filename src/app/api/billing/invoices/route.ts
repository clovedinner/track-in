import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { createInvoice, isBillingPlan } from "@/lib/billing/service";

export async function POST(request: Request) {
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
  } catch {
    return NextResponse.json({ error: "Unable to create invoice." }, { status: 503 });
  }
}
