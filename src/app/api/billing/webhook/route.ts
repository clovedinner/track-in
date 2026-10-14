import { NextResponse } from "next/server";

import { getBillingProvider } from "@/lib/billing/service";
import { hashBillingPayload, processBillingWebhook, safeWebhookInput, verifyWebhookSignature, BillingWebhookError } from "@/lib/billing/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
  const timestamp = request.headers.get("x-trakio-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-trakio-signature")?.trim() ?? "";
  const timestampNumber = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() - timestampNumber * 1000) > 5 * 60 * 1000) return NextResponse.json({ error: "Invalid webhook timestamp." }, { status: 401 });
  const rawBody = await request.text();
  if (!verifyWebhookSignature(secret, timestamp, rawBody, signature)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const input = safeWebhookInput(parsedBody);
  if (!input) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  try {
    return NextResponse.json(await processBillingWebhook(getBillingProvider(), input, hashBillingPayload(rawBody)));
  } catch (error) {
    if (error instanceof BillingWebhookError) return NextResponse.json({ error: error.code }, { status: error.httpStatus });
    return NextResponse.json({ error: "Unable to process billing event." }, { status: 503 });
  }
}
