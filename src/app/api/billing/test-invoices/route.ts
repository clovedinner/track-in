import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { createBillingTestInvoice } from "@/lib/billing/service";

export async function POST() {
  if (process.env.BILLING_TEST_MODE?.trim().toLowerCase() !== "true") {
    return NextResponse.json({ error: "Payment monitor tests are disabled." }, { status: 404 });
  }
  let user;
  try {
    user = await requireCurrentUser({ allowInactive: true });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    return NextResponse.json(await createBillingTestInvoice(user.id), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create test invoice.";
    const correlationId = randomUUID();
    console.error("[billing] test invoice creation failed", { correlationId, userId: user.id, error: message });
    const status = message.includes("already pending") ? 409 : 503;
    return NextResponse.json({ error: status === 409 ? message : "Unable to create test invoice.", correlationId }, { status });
  }
}
