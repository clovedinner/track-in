export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] px-5 py-8 text-[#17202a] sm:px-8 lg:px-12 lg:py-12" aria-busy="true" aria-label="Loading dashboard">
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="h-32 border-b border-[#c8c3b8] bg-[#faf8f3]" />
        <div className="h-36 border border-[#c8c3b8] bg-[#faf8f3]" />
        <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="h-32 border border-[#c8c3b8] bg-[#faf8f3]" key={index} />)}</div>
      </div>
    </main>
  );
}
