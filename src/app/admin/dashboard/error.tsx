"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#F0F0F0] px-5 py-8 text-[#121212] sm:px-8 lg:px-12 lg:py-12">
      <section className="mx-auto max-w-2xl border-2 border-[#D02020] bg-[#FFFFFF] px-6 py-8" role="alert">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020]">Dashboard unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold">The overview could not be loaded.</h1>
        <p className="mt-3 text-sm leading-6 text-[#121212]">Check the database connection and try again. No tracking data was changed.</p>
        <button className="mt-6 border-2 border-[#121212] bg-[#121212] px-5 py-2.5 text-sm font-semibold text-[#FFFFFF] hover:bg-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
