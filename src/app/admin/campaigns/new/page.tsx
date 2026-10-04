import Link from "next/link";
import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import CampaignForm from "@/app/admin/campaigns/new/campaign-form";

export const metadata: Metadata = { title: "New campaign | Track.in", description: "Create a private tracking campaign." };

export default function NewCampaignPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]">
      <AdminNavigation pathname="/admin/campaigns/new" />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="border-b border-[#c8c3b8] pb-8">
          <Link href="/admin/campaigns" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f2d] hover:underline">← Campaigns</Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Create a campaign</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#59636c]">
            Define the destination and the platform tokens this campaign is allowed to preserve. After saving, generate the tracking URL and GTM/postback setup artifacts.
          </p>
        </header>
        <CampaignForm />
      </div>
    </main>
  );
}
