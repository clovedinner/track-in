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

const plans: Plan[] = [
  {
    name: "Starter",
    price: "$100",
    note: "A focused first setup",
    features: ["Click and conversion tracking", "One campaign workspace", "Essential metrics"],
  },
  {
    name: "Operator",
    price: "$300",
    note: "The complete daily tracking loop",
    features: ["Campaign, offer, and source setup", "S2S conversion postbacks", "Delivery health and retries"],
    featured: true,
  },
  {
    name: "Expanded",
    price: "$500",
    note: "A broader active setup",
    features: ["Everything in Operator", "More campaign configurations", "More source connections"],
  },
];

const walletAddress = "TQ9pR6x7JY2m8hK4Vw3cN5sL1aB0dE9fG";
const qrPattern = [
  "1111111001011111111",
  "1000001011011000001",
  "1011101000011011101",
  "1011101110111011101",
  "1011101001011011101",
  "1000001010111000001",
  "1111111010101111111",
  "0000000011010000000",
  "1101011110111010111",
  "0010110011100101100",
  "1110001110111110001",
  "0101110001010011110",
  "1111111011101010011",
  "1000001110011110100",
  "1011101011110011111",
  "1011101110001010001",
  "1011101001111110110",
  "1000001010100111001",
  "1111111011111010111",
];

export default function SubscribePage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPlan(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function openPayment(plan: Plan) {
    setSubmitted(false);
    setCopied(false);
    setSelectedPlan(plan);
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
            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${plan.featured ? "text-[#FFFFFF]" : "text-[#D02020]"}`}>{plan.featured ? "Best fit" : "Track.in plan"}</p>
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
          <p className="mt-2 max-w-3xl text-sm leading-6">Choose a plan to open the payment mockup. It displays the plan amount in USDT, the TRC20 network, a copyable address, and a QR placeholder for the final wallet integration.</p>
        </div>
      </section>

      {selectedPlan ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/80 p-3 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlan(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-2 border-[#121212] bg-[#FFFFFF] shadow-[8px_8px_0_#F0C020]">
            <div className="flex items-start justify-between border-b-2 border-[#121212] bg-[#1040C0] px-5 py-4 text-[#FFFFFF] sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F0C020]">Payment mockup</p>
                <h2 id="payment-title" className="mt-1 text-2xl font-black">{submitted ? "Payment submitted for review" : `Subscribe to ${selectedPlan.name}`}</h2>
              </div>
              <button type="button" aria-label="Close payment dialog" onClick={() => setSelectedPlan(null)} className="min-h-11 min-w-11 border-2 border-[#FFFFFF] bg-transparent text-2xl leading-none text-[#FFFFFF] shadow-[3px_3px_0_#121212] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0C020]">×</button>
            </div>

            {submitted ? (
              <div className="px-5 py-8 sm:px-7 sm:py-10">
                <div className="border-2 border-[#121212] bg-[#F0C020] p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.13em]">Manual review required</p>
                  <p className="mt-3 text-sm leading-6">Your selected plan is {selectedPlan.name}. This mockup does not verify a blockchain transaction yet. An operator would confirm the transfer and activate the subscription.</p>
                </div>
                <button type="button" onClick={() => setSelectedPlan(null)} className="mt-7 min-h-11 bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Close</button>
              </div>
            ) : (
              <div className="px-5 py-6 sm:px-7 sm:py-8">
                <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-start">
                  <div className="border-2 border-[#121212] bg-[#FFFFFF] p-3" role="img" aria-label="Mock USDT TRC20 QR code">
                    <div className="grid aspect-square grid-cols-[repeat(19,minmax(0,1fr))] gap-px bg-[#FFFFFF] p-1">
                      {qrPattern.flatMap((row, rowIndex) => [...row].map((cell, columnIndex) => <span key={`${rowIndex}-${columnIndex}`} className={cell === "1" ? "bg-[#121212]" : "bg-[#FFFFFF]"} />))}
                    </div>
                    <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.12em]">Mock QR</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#121212] pb-4">
                      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D02020]">Amount</p><p className="mt-1 text-3xl font-black">{selectedPlan.price.replace("$", "")} USDT</p></div>
                      <div className="text-left sm:text-right"><p className="text-xs font-bold uppercase tracking-[0.14em]">Network</p><p className="mt-1 text-lg font-bold">TRON / TRC20</p></div>
                    </div>
                    <p className="mt-5 text-sm font-bold">Send exactly the plan amount to this address.</p>
                    <div className="mt-3 border-2 border-[#121212] bg-[#E0E0E0] p-3">
                      <code className="block break-all font-mono text-xs leading-5">{walletAddress}</code>
                    </div>
                    <button type="button" onClick={copyAddress} className="mt-3 min-h-11 bg-[#D02020] px-4 py-2.5 text-sm font-bold text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">{copied ? "Address copied" : "Copy address"}</button>
                  </div>
                </div>
                <p className="mt-7 border-l-4 border-[#D02020] bg-[#F0F0F0] px-4 py-3 text-sm leading-6">Use USDT on TRC20 only. Sending another asset or network can result in a permanent loss. This is a payment UI mockup and does not process funds.</p>
                <div className="mt-7 flex flex-col-reverse gap-3 border-t-2 border-[#121212] pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setSelectedPlan(null)} className="min-h-11 border-2 border-[#121212] bg-[#FFFFFF] px-5 py-3 text-sm font-bold text-[#121212] hover:bg-[#E0E0E0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">Cancel</button>
                  <button type="button" onClick={() => setSubmitted(true)} className="min-h-11 bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">I have paid</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
