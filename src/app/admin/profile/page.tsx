import type { Metadata } from "next";
import Link from "next/link";

import AdminNavigation from "@/app/admin/admin-navigation";

export const metadata: Metadata = {
  title: "Profile | Track.in",
  description: "Private operator profile and subscription status.",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/profile" />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="border-b-2 border-[#121212] pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D02020]">Track.in / account</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Your profile.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#121212]">
            Manage the private operator account and choose the plan that matches the tracking work you actually use.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="border-2 border-[#121212] bg-[#FFFFFF] p-6 shadow-[6px_6px_0_#121212]" aria-labelledby="account-heading">
            <div className="flex items-start justify-between gap-5 border-b-2 border-[#121212] pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D02020]">Operator</p>
                <h2 id="account-heading" className="mt-2 text-2xl font-bold">Private account</h2>
              </div>
              <span aria-hidden="true" className="h-12 w-12 rounded-full border-2 border-[#121212] bg-[#1040C0]" />
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="border-b-2 border-[#E0E0E0] pb-3">
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#121212]">Access</dt>
                <dd className="mt-1 font-semibold">Basic Auth protected</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#121212]">Workspace</dt>
                <dd className="mt-1 font-semibold">Personal tracking workspace</dd>
              </div>
            </dl>
          </section>

          <section className="border-2 border-[#121212] bg-[#F0C020] p-6 shadow-[6px_6px_0_#121212]" aria-labelledby="subscription-heading">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]">Current subscription</p>
                <h2 id="subscription-heading" className="mt-2 text-3xl font-black tracking-[-0.04em]">Free</h2>
                <p className="mt-3 max-w-lg text-sm leading-6">No paid plan is active and no payment method is stored.</p>
              </div>
              <span className="border-2 border-[#121212] bg-[#FFFFFF] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">Default</span>
            </div>
            <div className="mt-7 border-t-2 border-[#121212] pt-5">
              <p className="text-sm leading-6">Select a plan to open the USDT TRC20 payment mockup. Payment confirmation is manual in this first version.</p>
              <Link href="/admin/subscribe" className="mt-5 inline-flex min-h-11 items-center border-2 border-[#121212] bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] shadow-[4px_4px_0_#121212] transition hover:bg-[#D02020] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">
                Subscribe
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
