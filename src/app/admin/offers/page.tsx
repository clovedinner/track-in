import type { Metadata } from "next";
import AdminNavigation from "@/app/admin/admin-navigation";
import OffersClient from "./offers-client";

export const metadata: Metadata = { title: "Offers | Trakio", description: "Offers and conversion performance." };
export const dynamic = "force-dynamic";

export default function OffersPage() {
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/offers" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><OffersClient /></div></main>;
}
