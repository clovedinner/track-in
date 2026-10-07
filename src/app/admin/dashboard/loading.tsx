export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] px-5 py-8 text-[#121212] sm:px-8 lg:px-12 lg:py-12" aria-busy="true" aria-label="Loading dashboard">
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="h-32 border-b-2 border-[#121212] bg-[#FFFFFF]" />
        <div className="h-36 border-2 border-[#121212] bg-[#FFFFFF]" />
        <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="h-32 border-2 border-[#121212] bg-[#FFFFFF]" key={index} />)}</div>
      </div>
    </main>
  );
}
