"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PaymentViewStatus = "checking" | "confirmed" | "failed" | "waiting" | "unavailable";

function isTerminalFailure(status: string) {
  return status === "failed" || status === "expired" || status === "refunded" || status === "canceled";
}

export default function PaymentDoneStatus({ invoiceId }: { invoiceId: string | null }) {
  const [status, setStatus] = useState<PaymentViewStatus>(invoiceId ? "checking" : "unavailable");

  useEffect(() => {
    if (!invoiceId) return;

    let stopped = false;
    let attempts = 0;
    let timer: number | undefined;

    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`, { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { status?: unknown };
          if (typeof result.status === "string") {
            if (result.status === "confirmed") {
              if (!stopped) setStatus("confirmed");
              return;
            }
            if (isTerminalFailure(result.status)) {
              if (!stopped) setStatus("failed");
              return;
            }
          }
        } else if (response.status === 404 || response.status === 401) {
          if (!stopped) setStatus("unavailable");
          return;
        }
      } catch {
        // Keep checking; a temporary connection issue should not hide the payment status.
      }

      attempts += 1;
      if (stopped) return;
      if (attempts >= 24) {
        setStatus("waiting");
        return;
      }
      timer = window.setTimeout(() => void checkPayment(), 5_000);
    };

    void checkPayment();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [invoiceId]);

  const content = {
    checking: {
      label: "Payment",
      title: "Checking your payment.",
      message: "NOWPayments sent you back to Trakio. We’re waiting for its confirmation before activating your subscription. This can take a moment.",
    },
    confirmed: {
      label: "Payment confirmed",
      title: "Thank you for your payment.",
      message: "Your subscription is active. You can go to your dashboard now.",
    },
    failed: {
      label: "Payment not completed",
      title: "We couldn’t confirm this payment.",
      message: "Return to the subscription page to review the payment or create a new invoice.",
    },
    waiting: {
      label: "Still processing",
      title: "Your payment is taking longer to confirm.",
      message: "NOWPayments has not sent confirmation to Trakio yet. You can check your dashboard again in a moment; your plan activates once confirmation arrives.",
    },
    unavailable: {
      label: "Payment status",
      title: "Thanks for completing checkout.",
      message: "We couldn’t check the invoice status in this browser. Open your dashboard to see whether your subscription has activated.",
    },
  }[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F0F0F0] px-5 py-10 text-[#121212]">
      <section className="w-full max-w-xl border-2 border-[#121212] bg-[#FFFFFF] shadow-[8px_8px_0_#F0C020]" aria-labelledby="payment-done-title">
        <header className="border-b-2 border-[#121212] bg-[#1040C0] px-6 py-5 text-[#FFFFFF] sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F0C020]">Trakio · Payment</p>
          <h1 id="payment-done-title" className="mt-2 text-3xl font-black tracking-[-0.04em]">{content.title}</h1>
        </header>
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D02020]">{content.label}</p>
          <p aria-live="polite" className="mt-3 text-sm leading-6">{content.message}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/admin/dashboard" className="inline-flex min-h-11 items-center justify-center border-2 border-[#121212] bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] shadow-[4px_4px_0_#121212] hover:bg-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Go to dashboard</Link>
            {status === "failed" ? <Link href="/admin/subscribe" className="inline-flex min-h-11 items-center justify-center border-2 border-[#121212] bg-[#FFFFFF] px-5 py-3 text-sm font-bold hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Back to plans</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
