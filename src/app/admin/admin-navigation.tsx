import Link from "next/link";

import { adminNavigation, isAdminNavigationActive } from "@/lib/admin/navigation";

export default function AdminNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Private navigation" className="border-b border-[#c8c3b8] bg-[#faf8f3]">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-2 px-5 py-3 sm:px-8 lg:px-12">
        {adminNavigation.map((item) => {
          const active = isAdminNavigationActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f2d] ${active ? "border-[#a34f2d] text-[#17202a]" : "border-transparent text-[#59636c] hover:border-[#c8c3b8] hover:text-[#17202a]"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
