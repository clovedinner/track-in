"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const router = useRouter();
  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      const response = await fetch(`/api/auth/${mode === "sign-up" ? "signup" : "signin"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Authentication failed.");
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin/dashboard";
      router.push(destination);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed.");
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F0F0F0] px-5 py-10 text-[#121212] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 border-2 border-[#121212] bg-[#FFFFFF] px-2 py-1 text-lg font-black shadow-[3px_3px_0_#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#D02020]" /><span aria-hidden="true" className="h-3 w-3 bg-[#1040C0]" /><span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#F0C020]" /><span className="ml-1">Trakio</span></Link>
        <section className="mt-10 border-2 border-[#121212] bg-[#FFFFFF] p-6 shadow-[6px_6px_0_#121212] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020]">Private access</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">{isSignUp ? "Create your account." : "Welcome back."}</h1>
          <p className="mt-3 text-sm leading-6">{isSignUp ? "Create an email and password account for the Trakio dashboard." : "Sign in to manage campaigns, sources, offers, and delivery health."}</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-bold">Email<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block min-h-11 w-full border-2 border-[#121212] bg-[#FFFFFF] px-3 py-2.5 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" /></label>
            <label className="block text-sm font-bold">Password<input required minLength={12} autoComplete={isSignUp ? "new-password" : "current-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block min-h-11 w-full border-2 border-[#121212] bg-[#FFFFFF] px-3 py-2.5 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" />{isSignUp ? <span className="mt-2 block text-xs font-normal">Use at least 12 characters.</span> : null}</label>
            {error ? <p role="alert" className="border-2 border-[#D02020] bg-[#F0F0F0] px-3 py-3 text-sm text-[#D02020]">{error}</p> : null}
            <button type="submit" disabled={working} className="min-h-11 w-full bg-[#1040C0] px-5 py-3 text-sm font-bold text-[#FFFFFF] hover:bg-[#D02020] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">{working ? "Please wait" : isSignUp ? "Create account" : "Sign in"}</button>
          </form>
          <p className="mt-6 border-t-2 border-[#121212] pt-5 text-sm">{isSignUp ? "Already have an account?" : "Need an account?"} <Link href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"} className="font-bold text-[#D02020] underline underline-offset-4">{isSignUp ? "Sign in" : "Sign up"}</Link></p>
        </section>
      </div>
    </main>
  );
}
