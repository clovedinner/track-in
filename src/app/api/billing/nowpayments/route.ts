import { NextResponse } from "next/server";

import { BillingWebhookError, hashBillingPayload, processNowPaymentsWebhook } from "@/lib/billing/service";
import { verifyNowPaymentsSignature } from "@/lib/billing/nowpayments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "NOWPayments IPN is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 32_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 32_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid payment notification." }, { status: 400 });
  }
  const signature = request.headers.get("x-nowpayments-sig") ?? "";
  if (!verifyNowPaymentsSignature(secret, payload, signature)) return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });

  try {
    return NextResponse.json(await processNowPaymentsWebhook(payload, hashBillingPayload(rawBody)));
  } catch (error) {
    if (error instanceof BillingWebhookError) return NextResponse.json({ error: error.code }, { status: error.httpStatus });
    console.error("[billing] NOWPayments notification processing failed", { error: error instanceof Error ? error.message : "unknown error" });
    return NextResponse.json({ error: "Unable to process payment notification." }, { status: 503 });
  }
}
