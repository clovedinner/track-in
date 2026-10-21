import Link from "next/link";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

export default function PublicSiteNav() {
  return (
    <header className="border-b-2 border-[#121212] bg-[#F0F0F0]">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12" aria-label="Main navigation">
        <Link href="/" className="flex shrink-0 items-center gap-1 border-2 border-[#121212] bg-[#FFFFFF] px-2 py-1 text-lg font-black tracking-[-0.03em] shadow-[3px_3px_0_#121212]">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#D02020]" />
          <span aria-hidden="true" className="h-3 w-3 bg-[#1040C0]" />
          <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#F0C020]" />
          <span className="ml-1">Trakio</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
          <Link href="/docs" className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Docs</Link>
          <Link href="/articles" className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Articles</Link>
          <Link href={`${appUrl}/auth/sign-in`} className="text-[#D02020] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D02020]">Sign in</Link>
        </div>
      </nav>
    </header>
  );
}
