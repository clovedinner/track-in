"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#f4f1ea] px-5 py-8 text-[#17202a] sm:px-8 lg:px-12 lg:py-12">
      <section className="mx-auto max-w-2xl border border-[#a34f2d] bg-[#fffaf5] px-6 py-8" role="alert">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f2d]">Dashboard unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold">The overview could not be loaded.</h1>
        <p className="mt-3 text-sm leading-6 text-[#59636c]">Check the database connection and try again. No tracking data was changed.</p>
        <button className="mt-6 border border-[#17202a] bg-[#17202a] px-5 py-2.5 text-sm font-semibold text-[#faf8f3] hover:bg-[#38434b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f2d]" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
