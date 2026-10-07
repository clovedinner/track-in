import Link from "next/link";

import { adminNavigation, isAdminNavigationActive } from "@/lib/admin/navigation";

export default function AdminNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Private navigation" className="border-b-2 border-[#121212] bg-[#FFFFFF]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 sm:px-8 lg:px-12">
        <Link href="/admin" aria-label="Track.in home" className="mr-2 flex items-center gap-1 border-2 border-[#121212] bg-[#FFFFFF] px-2 py-1 shadow-[3px_3px_0_#121212]">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#D02020]" />
          <span aria-hidden="true" className="h-3 w-3 bg-[#1040C0]" />
          <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#F0C020]" />
          <span className="ml-1 text-sm font-black tracking-tight">Track.in</span>
        </Link>
        {adminNavigation.map((item) => {
          const active = isAdminNavigationActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D02020] ${active ? "border-[#D02020] text-[#121212]" : "border-transparent text-[#121212] hover:border-[#121212] hover:text-[#121212]"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
