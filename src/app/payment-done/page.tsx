import type { Metadata } from "next";

import PaymentDoneStatus from "./payment-done-status";

export const metadata: Metadata = {
  title: "Payment complete | Trakio",
  description: "Check your Trakio subscription payment status.",
};

export default async function PaymentDonePage({
  searchParams,
}: {
  searchParams?: Promise<{ invoice_id?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const invoiceId = typeof params.invoice_id === "string" && params.invoice_id.length <= 128
    ? params.invoice_id
    : null;

  return <PaymentDoneStatus invoiceId={invoiceId} />;
}
