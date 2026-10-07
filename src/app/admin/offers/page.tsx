import type { Metadata } from "next";
import AdminNavigation from "@/app/admin/admin-navigation";
import OffersClient from "./offers-client";

export const metadata: Metadata = { title: "Offers | Track.in", description: "Offers and conversion performance." };
export const dynamic = "force-dynamic";

export default function OffersPage() {
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/offers" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><header className="border-b-2 border-[#121212] pb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D02020]">Track.in / private</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Offers</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#121212]">Offer-level performance from the clicks and conversions already recorded.</p></header><OffersClient /></div></main>;
}
