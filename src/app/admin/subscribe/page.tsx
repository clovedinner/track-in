import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import SubscribePage from "./subscribe-page";

export const metadata: Metadata = {
  title: "Subscribe | Track.in",
  description: "Choose a Track.in subscription plan.",
};

export default function SubscribeRoute() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/subscribe" />
      <SubscribePage />
    </main>
  );
}
