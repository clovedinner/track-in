"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Plan = {
  name: string;
  price: string;
  note: string;
  features: string[];
  featured?: boolean;
};

type Invoice = {
  invoiceId: string;
  amountMinor: string;
  paymentAmountAtomic: string | null;
  currency: string;
  network: string | null;
  status: string;
  isTest?: boolean;
  walletAddress?: string;
  transactionHash?: string | null;
  checkoutUrl: string | null;
};

const plans: Plan[] = [
  {
    name: "Starter",
    price: "$300",
    note: "A focused first setup",
    features: ["Click and conversion tracking", "One campaign workspace", "Essential metrics", "S2S conversion postbacks"],
  },
  {
    name: "Operator", 
    price: "$500",
    note: "The complete daily tracking loop",
    features: ["Campaign, offer, and source setup", "S2S conversion postbacks", "Delivery health and retries"],
    featured: true,
  },
  {
    name: "Expanded",
    price: "$1000",
    note: "A broader active setup",
    features: ["Everything in Operator", "More campaign configurations", "More source connections"],
  },
];

function formatUsdt(atomic: string | null | undefined, amountMinor: string | null | undefined, currency: string | undefined) {
  if (atomic) {
    const units = BigInt(atomic);
    const scale = BigInt(1_000_000);
    const whole = units / scale;
    const fraction = (units % scale).toString().padStart(6, "0");
    return `${whole}.${fraction} ${currency ?? "USDT"}`;
  }
  return `${(Number(amountMinor ?? "0") / 100).toFixed(2)} ${currency ?? "USDT"}`;
}

export default function SubscribePage({ showTestPayment = false, paymentProvider = "tron" }: { showTestPayment?: boolean; paymentProvider?: string }) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceWorking, setInvoiceWorking] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPlan(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!selectedPlan || !invoice?.invoiceId || invoice.status !== "pending") return;
    let stopped = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/billing/invoices/${encodeURIComponent(invoice.invoiceId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const status = await response.json() as { status?: string; transactionHash?: string | null; paymentAmountAtomic?: string | null; isTest?: boolean };
        if (stopped || typeof status.status !== "string") return;
        setInvoice((current) => current ? { ...current, status: status.status!, transactionHash: status.transactionHash, paymentAmountAtomic: status.paymentAmountAtomic ?? current.paymentAmountAtomic, isTest: status.isTest ?? current.isTest } : current);
        if (status.status === "confirmed") setSubmitted(true);
        if (status.status === "failed") setInvoiceError("This payment did not complete. Create a new invoice to try again.");
      } catch {
        // Keep showing the pending state; the next poll will retry the read.
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 8_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [selectedPlan, invoice?.invoiceId, invoice?.status]);

  async function copyAddress() {
    if (!invoice?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(invoice.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function openPayment(plan: Plan, testOnly = false) {
    setSubmitted(false);
    setCopied(false);
    setInvoice(null);
    setInvoiceError(null);
    setSelectedPlan(plan);
    setInvoiceWorking(true);
    try {
      const response = await fetch(testOnly ? "/api/billing/test-invoices" : "/api/billing/invoices", {
        method: "POST",
        ...(testOnly ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: plan.name }) }),
      });
      const payload = await response.json().catch(() => null) as Invoice | { error?: string } | null;
      if (!response.ok || !payload || !("invoiceId" in payload)) throw new Error((payload as { error?: string } | null)?.error ?? "Unable to create invoice.");
      setInvoice(payload);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "Unable to create invoice.");
    } finally {
      setInvoiceWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <header className="flex flex-col gap-6 border-b-2 border-[#121212] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin/profile" className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Back to profile</Link>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Choose your plan.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6">Simple plans for operators who want the tracking loop without paying for features they do not use.</p>
        </div>
        <div className="border-2 border-[#121212] bg-[#FFFFFF] px-4 py-3 text-xs font-bold uppercase tracking-[0.13em] shadow-[4px_4px_0_#121212]">
          Payment network: USDT / TRC20
        </div>
      </header>

      <section className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Subscription plans">
        {plans.map((plan) => (
          <article key={plan.name} className={`relative flex flex-col border-2 border-[#121212] p-6 shadow-[6px_6px_0_#121212] transition hover:-translate-y-1 ${plan.featured ? "bg-[#1040C0] text-[#FFFFFF]" : "bg-[#FFFFFF]"}`}>
            <span aria-hidden="true" className={`absolute right-5 top-5 h-4 w-4 ${plan.featured ? "rounded-full bg-[#F0C020]" : "bg-[#D02020]"}`} />
            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${plan.featured ? "text-[#FFFFFF]" : "text-[#D02020]"}`}>{plan.featured ? "Best fit" : "Plan"}</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em]">{plan.name}</h2>
            <p className={`mt-2 text-sm ${plan.featured ? "text-[#FFFFFF]" : "text-[#121212]"}`}>{plan.note}</p>
            <p className="mt-8 text-5xl font-black tracking-[-0.06em]">{plan.price}<span className="ml-1 text-sm font-medium tracking-normal">/month</span></p>
            <ul className={`mt-8 flex-1 space-y-3 border-t-2 pt-6 text-sm leading-6 ${plan.featured ? "border-[#FFFFFF]/50" : "border-[#121212]"}`}>
              {plan.features.map((feature) => <li key={feature} className="flex gap-3"><span className={plan.featured ? "text-[#F0C020]" : "text-[#D02020]"} aria-hidden="true">■</span><span>{feature}</span></li>)}
            </ul>
            <button type="button" onClick={() => openPayment(plan)} className={`mt-8 min-h-11 px-5 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${plan.featured ? "border-2 border-[#121212] bg-[#F0C020] text-[#121212] shadow-[4px_4px_0_#121212] focus-visible:outline-[#FFFFFF]" : "bg-[#D02020] text-[#FFFFFF] focus-visible:outline-[#D02020]"}`}>
              Select {plan.name}
            </button>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-5 border-2 border-[#121212] bg-[#F0C020] p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8" aria-label="Payment information">
        <div className="h-12 w-12 border-2 border-[#121212] bg-[#D02020]" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black">One payment method.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">{paymentProvider === "nowpayments" ? "Pay with USDT on TRC20 through NOWPayments. Trakio activates your subscription after the provider confirms payment." : "Pay with USDT on TRC20. Trakio checks confirmed transfers automatically and activates the subscription when it finds the exact invoice amount."}</p>
        </div>
      </section>

      {showTestPayment ? (
        <section className="mt-6 flex flex-col gap-4 border-2 border-[#121212] bg-[#FFFFFF] p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Payment monitor test">
          <div>
            <h2 className="font-black">Test payment monitoring</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6">{paymentProvider === "nowpayments" ? "Create a one-time $20 USD invoice for USDT on TRC20. NOWPayments adds applicable fees at checkout. After its confirmation, Trakio activates Starter for 30 days on the designated test account." : "Create a one-time 0.10 USDT TRC20 invoice. After the monitor confirms the transfer, it activates the Starter plan for 30 days on the designated test account."}</p>
          </div>
          <button type="button" onClick={() => void openPayment({ name: "Payment monitor test", price: paymentProvider === "nowpayments" ? "$20" : "$0.10", note: "Detection test only", features: [] }, true)} className="min-h-11 shrink-0 border-2 border-[#121212] bg-[#FFFFFF] px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#121212] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">{paymentProvider === "nowpayments" ? "Create $20 test invoice" : "Create $0.10 test invoice"}</button>
        </section>
      ) : null}

      {selectedPlan ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/80 p-3 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlan(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-2 border-[#121212] bg-[#FFFFFF] shadow-[8px_8px_0_#F0C020]">
            <div className="flex items-start justify-between border-b-2 border-[#121212] bg-[#1040C0] px-5 py-4 text-[#FFFFFF] sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F0C020]">Payment</p>
                <h2 id="payment-title" className="mt-1 text-2xl font-black">{submitted ? (invoice?.isTest ? "Starter plan activated" : "Payment confirmed") : invoice?.isTest ? "Payment monitor test" : `Subscribe to ${selectedPlan.name}`}</h2>
              </div>
              <button type="button" aria-label="Close payment dialog" onClick={() => setSelectedPlan(null)} className="min-h-11 min-w-11 border-2 border-[#FFFFFF] bg-transparent text-2xl leading-none text-[#FFFFFF] shadow-[3px_3px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0C020]">×</button>
            </div>

            {submitted ? (
              <div className="px-5 py-8 sm:px-7 sm:py-10">
                <div className="flex flex-col gap-4 border-2 border-[#121212] bg-[#F0C020] p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em]">Payment status</p>
                    <h3 className="mt-2 text-3xl font-black tracking-[-0.04em]">{invoice?.isTest ? "Starter plan activated" : "Payment confirmed"}</h3>
                    <p className="mt-2 text-sm leading-6">{invoice?.isTest ? invoice.checkoutUrl ? "NOWPayments confirmed the $20 USD test invoice. Starter is active for 30 days on this test account." : "The confirmed 0.10 USDT test transfer activated Starter for 30 days on this test account." : "The payment provider confirmed this invoice and your subscription is active."}</p>
                  </div>
                  <span className="w-fit border-2 border-[#121212] bg-[#FFFFFF] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">Invoice</span>
                </div>
                <section className="mt-6 border-2 border-[#121212] bg-[#FFFFFF]" aria-labelledby="invoice-heading">
                  <div className="flex flex-col gap-3 border-b-2 border-[#121212] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D02020]">Invoice</p>
                      <h3 id="invoice-heading" className="mt-1 text-xl font-black">{invoice?.isTest ? "Starter plan" : `${selectedPlan.name} subscription`}</h3>
                    </div>
                    <p className="font-mono text-xs font-bold">{invoice?.invoiceId ?? "Invoice pending"}</p>
                  </div>
                  <dl className="divide-y-2 divide-[#121212] px-5 text-sm">
                    <div className="flex items-start justify-between gap-5 py-4"><dt className="font-bold">Item</dt><dd className="text-right">{invoice?.isTest ? "Starter plan" : `${selectedPlan.name} plan`}</dd></div>
                    <div className="flex items-start justify-between gap-5 py-4"><dt className="font-bold">Billing period</dt><dd className="text-right">Monthly</dd></div>
                    <div className="flex items-start justify-between gap-5 py-4"><dt className="font-bold">Payment method</dt><dd className="text-right">USDT on {invoice?.network ?? "TRC20"}</dd></div>
                    <div className="flex items-start justify-between gap-5 py-4"><dt className="font-bold">Payment provider</dt><dd className="text-right">{invoice?.checkoutUrl ? "NOWPayments" : "Trakio invoice"}</dd></div>
                  </dl>
                  <div className="flex items-center justify-between border-t-2 border-[#121212] bg-[#1040C0] px-5 py-4 text-[#FFFFFF]"><span className="text-sm font-bold uppercase tracking-[0.12em]">Invoice total</span><span className="text-2xl font-black">{formatUsdt(invoice?.paymentAmountAtomic, invoice?.amountMinor, invoice?.currency)}</span></div>
                  {invoice?.transactionHash ? <p className="break-all px-5 py-3 font-mono text-xs">Transaction: {invoice.transactionHash}</p> : null}
                </section>
                <div className="mt-7 flex flex-col-reverse gap-3 border-t-2 border-[#121212] pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setSelectedPlan(null)} className="min-h-11 border-2 border-[#121212] bg-[#FFFFFF] px-5 py-3 text-sm font-bold text-[#121212] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Close</button>
                  {invoice?.isTest ? null : <Link href="/admin/profile" onClick={() => setSelectedPlan(null)} className="inline-flex min-h-11 items-center justify-center bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">View profile</Link>}
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 sm:px-7 sm:py-8">
                {invoiceWorking ? (
                  <div role="status" aria-label="Creating your invoice" className="animate-pulse space-y-6">
                    <span className="sr-only">Creating your invoice…</span>
                    <div className="flex items-end justify-between gap-5 border-b-2 border-[#121212] pb-4">
                      <div className="space-y-3"><div className="h-3 w-24 bg-[#E0E0E0]" /><div className="h-9 w-48 bg-[#E0E0E0]" /></div>
                      <div className="space-y-3"><div className="ml-auto h-3 w-20 bg-[#E0E0E0]" /><div className="h-6 w-28 bg-[#E0E0E0]" /></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 w-full bg-[#E0E0E0]" />
                      <div className="h-3 w-4/5 bg-[#E0E0E0]" />
                      <div className="h-11 w-56 bg-[#E0E0E0]" />
                      <div className="h-3 w-64 bg-[#E0E0E0]" />
                    </div>
                    <div className="border-t-2 border-[#121212] pt-5"><div className="ml-auto h-11 w-24 bg-[#E0E0E0]" /></div>
                  </div>
                ) : null}
                {invoiceError && !invoiceWorking ? <p role="alert" className="mb-5 border-2 border-[#D02020] bg-[#FFF4F0] px-4 py-3 text-sm text-[#D02020]">{invoiceError}</p> : null}
                {invoiceError && paymentProvider === "nowpayments" && selectedPlan && !invoiceWorking ? <button type="button" onClick={() => void openPayment(selectedPlan)} className="mb-5 min-h-11 border-2 border-[#121212] bg-[#F0C020] px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Create a new invoice</button> : null}
                {!invoiceWorking && !invoiceError && invoice ? <>
                <div>
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#121212] pb-4">
                      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D02020]">{paymentProvider === "nowpayments" ? "Plan price" : "Exact invoice amount"}</p><p className="mt-1 text-3xl font-black">{paymentProvider === "nowpayments" ? `$${(Number(invoice?.amountMinor ?? String(Number(selectedPlan.price.replace("$", "")) * 100)) / 100).toFixed(2)} USD` : invoice ? formatUsdt(invoice.paymentAmountAtomic, invoice.amountMinor, invoice.currency) : `${Number(selectedPlan.price.replace("$", "")).toFixed(2)} USDT`}</p></div>
                      <div className="text-left sm:text-right"><p className="text-xs font-bold uppercase tracking-[0.14em]">Network</p><p className="mt-1 text-lg font-bold">USDT / TRC20</p></div>
                    </div>
                    {invoice?.checkoutUrl ? (
                      <>
                        <p className="mt-5 text-sm font-bold">Continue to NOWPayments to pay in USDT.</p>
                        <p className="mt-1 text-xs leading-5">The checkout shows the current USDT total, including applicable NOWPayments fees. Your wallet may list its own network fee separately. Trakio activates your subscription after payment is confirmed.</p>
                        <a href={invoice.checkoutUrl} className="mt-4 inline-flex min-h-11 items-center justify-center border-2 border-[#121212] bg-[#D02020] px-5 py-3 text-sm font-bold text-[#FFFFFF] shadow-[4px_4px_0_#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Continue to secure payment</a>
                        <p className="mt-4 font-mono text-xs">Invoice reference: {invoice.invoiceId}</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-5 text-sm font-bold">Send the exact amount shown. It includes a unique payment reference so Trakio can match this transfer to your invoice.</p>
                        <div className="mt-3 border-2 border-[#121212] bg-[#E0E0E0] p-3"><code className="block break-all font-mono text-xs leading-5">{invoice?.walletAddress ?? "Wallet address not configured"}</code></div>
                        <button type="button" onClick={copyAddress} className="mt-3 min-h-11 bg-[#D02020] px-4 py-2.5 text-sm font-bold text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">{copied ? "Address copied" : "Copy address"}</button>
                      </>
                    )}
                </div>
                {!invoice.checkoutUrl ? <p className="mt-7 border-l-4 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm leading-6">Use USDT on TRC20 only. Sending another asset or network can result in a permanent loss.</p> : null}
                <div className="mt-7 flex flex-col-reverse gap-3 border-t-2 border-[#121212] pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setSelectedPlan(null)} className="min-h-11 border-2 border-[#121212] bg-[#FFFFFF] px-5 py-3 text-sm font-bold text-[#121212] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Cancel</button>
                </div>
                </> : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
