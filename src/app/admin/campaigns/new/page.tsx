import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import CampaignForm from "@/app/admin/campaigns/new/campaign-form";

export const metadata: Metadata = { title: "New campaign | Track.in", description: "Create a private tracking campaign." };

export default function NewCampaignPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]">
      <AdminNavigation pathname="/admin/campaigns/new" />
      <div className="mx-auto min-h-[calc(100vh-52px)] max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f2d]">Campaigns / new</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Campaign workspace</h1>
        <p className="mt-2 text-sm text-[#59636c]">The campaign creation dialog is open.</p>
        <CampaignForm />
      </div>
    </main>
  );
}
