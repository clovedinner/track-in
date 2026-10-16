import Link from "next/link";

import { adminNavigation, isAdminNavigationActive } from "@/lib/admin/navigation";
import SignOutButton from "@/app/admin/sign-out-button";
import TimezoneSelector from "@/app/admin/timezone-selector";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AdminNavigation({ pathname }: { pathname: string }) {
  const user = await getCurrentUser();
  return (
    <nav aria-label="Private navigation" className="border-b-2 border-[#121212] bg-[#FFFFFF]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <Link href="/admin/dashboard" aria-label="Trakio dashboard" className="flex shrink-0 items-center gap-1 border-2 border-[#121212] bg-[#FFFFFF] px-2 py-1 shadow-[3px_3px_0_#121212]">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#D02020]" />
          <span aria-hidden="true" className="h-3 w-3 bg-[#1040C0]" />
          <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#F0C020]" />
          <span className="ml-1 text-sm font-black tracking-tight">Trakio</span>
        </Link>
        <div className="order-3 flex min-w-0 basis-full items-center gap-5 overflow-x-auto border-t border-[#D8D8D8] pt-3 sm:order-none sm:flex-1 sm:basis-auto sm:border-t-0 sm:pt-0">
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
        <div className="ml-auto flex shrink-0 items-center gap-2 border-l-2 border-[#121212] pl-3">
        <TimezoneSelector initialTimezone={user?.timezone ?? "UTC"} />
        <Link
          href="/admin/profile"
          aria-current={pathname === "/admin/profile" ? "page" : undefined}
          className={`ml-auto min-h-11 border-2 px-4 py-2 text-sm font-bold shadow-[3px_3px_0_#121212] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D02020] ${pathname === "/admin/profile" ? "border-[#121212] bg-[#F0C020] text-[#121212]" : "border-[#121212] bg-[#FFFFFF] text-[#121212] hover:bg-[#F0C020]"}`}
        >
          Profile
        </Link>
        <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
