import Link from "next/link";
import type { Metadata } from "next";
import AdminNavigation from "@/app/admin/admin-navigation";
import { prisma } from "@/lib/database/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import CampaignSetupContent from "./setup-content";

export const metadata: Metadata = { title: "Campaign setup | Trakio", description: "Private campaign tracking and GTM setup." };
export const dynamic = "force-dynamic";

export default async function CampaignSetupPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const user = await requireCurrentUser();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId, ownerId: user.id }, select: { id: true, slug: true, name: true, status: true, trackingMode: true, destinationUrl: true, offerId: true, defaultCurrency: true, allowedTrackingParameters: true, trafficSource: { select: { type: true, enabled: true, configuration: true } } } });
  if (!campaign) return <main className="min-h-screen bg-[#F0F0F0] px-5 py-10 text-[#121212]"><Link href="/admin/campaigns" className="text-sm text-[#D02020] hover:underline">Back to campaigns</Link><h1 className="mt-5 text-2xl font-semibold">Campaign not found.</h1></main>;
  return <main className="min-h-screen bg-[#F0F0F0] text-[#121212]"><AdminNavigation pathname="/admin/campaigns" /><div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><Link href={`/admin/campaigns/${campaign.id}`} className="text-xs font-bold uppercase tracking-[0.18em] text-[#D02020] hover:underline">← Campaign detail</Link><CampaignSetupContent campaign={campaign} /></div></main>;
}
