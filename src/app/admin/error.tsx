"use client";

import Link from "next/link";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="min-h-screen bg-[#F0F0F0] px-5 py-8 text-[#121212]">
      <section className="mx-auto max-w-2xl border-2 border-[#D02020] bg-white p-6" role="alert">
        <h1 className="text-2xl font-semibold">This workspace page couldn’t load</h1>
        {error.digest && <p className="mt-3 text-sm">Error reference {error.digest}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold">
          <button type="button" onClick={retry} className="border-2 border-[#121212] bg-[#121212] px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2">
            Try again
          </button>
          <Link href="/admin/dashboard" className="underline">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
