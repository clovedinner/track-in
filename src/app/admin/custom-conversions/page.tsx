import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import CustomConversionsClient from "./custom-conversions-client";

export const metadata: Metadata = { title: "Custom conversions | Trakio", description: "Configure your conversion event names and accepted event values." };
export const dynamic = "force-dynamic";

export default async function CustomConversionsPage() {
  await requireCurrentUser();
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/custom-conversions" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><CustomConversionsClient /></div></main>;
}
