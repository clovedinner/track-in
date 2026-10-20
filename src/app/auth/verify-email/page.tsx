import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email | Trakio", description: "Confirm your email to finish setting up your Trakio account." };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const address = typeof email === "string" && email.length <= 254 ? email : null;

  return (
    <main className="min-h-screen bg-[#F0F0F0] px-5 py-10 text-[#121212] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 border-2 border-[#121212] bg-[#FFFFFF] px-2 py-1 text-lg font-black shadow-[3px_3px_0_#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#D02020]" /><span aria-hidden="true" className="h-3 w-3 bg-[#1040C0]" /><span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#F0C020]" /><span className="ml-1">Trakio</span></Link>
        <section className="mt-10 border-2 border-[#121212] bg-[#FFFFFF] p-6 shadow-[6px_6px_0_#121212] sm:p-8" aria-labelledby="check-email-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020]">One more step</p>
          <h1 id="check-email-title" className="mt-3 text-4xl font-black tracking-[-0.05em]">Check your email.</h1>
          <p className="mt-4 text-sm leading-6">We sent a confirmation link to:</p>
          {address ? <p className="mt-1 break-all text-sm font-bold">{address}</p> : null}
          <p className="mt-2 text-sm leading-6">Open it to confirm your account, then sign in to choose a subscription.</p>
          <p className="mt-4 border-l-4 border-[#F0C020] bg-[#F0F0F0] px-4 py-3 text-sm leading-6">The link is valid for 24 hours. If you do not see the message, check your spam folder.</p>
          <Link href="/auth/sign-in" className="mt-7 inline-flex min-h-11 w-full items-center justify-center bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">Go to login</Link>
        </section>
      </div>
    </main>
  );
}
