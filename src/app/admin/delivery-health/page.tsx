import type { Metadata } from "next";

import DeliveryHealthClient from "./delivery-health-client";
import AdminNavigation from "@/app/admin/admin-navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Delivery health | Trakio",
  description: "Private outbound postback delivery health.",
};

export default async function DeliveryHealthPage() {
  const user = await requireCurrentUser();
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/delivery-health" /><DeliveryHealthClient timezone={user.timezone} /></main>;
}
