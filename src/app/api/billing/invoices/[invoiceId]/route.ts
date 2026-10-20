import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";

export async function GET(_request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  let user;
  try {
    user = await requireCurrentUser({ allowInactive: true });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { invoiceId } = await context.params;
  const payment = await prisma.billingPayment.findFirst({
    where: { invoiceId, userId: user.id },
    select: { invoiceId: true, status: true, transactionHash: true, confirmedAt: true, paymentAmountAtomic: true },
  });
  if (!payment) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  return NextResponse.json({
    invoiceId: payment.invoiceId,
    status: payment.status,
    transactionHash: payment.transactionHash,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    paymentAmountAtomic: payment.paymentAmountAtomic?.toString() ?? null,
  }, { headers: { "cache-control": "no-store" } });
}
