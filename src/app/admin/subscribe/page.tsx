import type { Metadata } from "next";

import AdminNavigation from "@/app/admin/admin-navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getBillingProvider } from "@/lib/billing/service";
import { canUseBillingTestMode } from "@/lib/billing/test-access";
import SubscribePage from "./subscribe-page";

export const metadata: Metadata = {
  title: "Subscribe | Trakio",
  description: "Choose a Trakio subscription plan.",
};

export default async function SubscribeRoute() {
  const user = await requireCurrentUser({ allowInactive: true });
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#121212]">
      <AdminNavigation pathname="/admin/subscribe" />
      <SubscribePage showTestPayment={["tron", "nowpayments"].includes(getBillingProvider()) && canUseBillingTestMode(user.id)} paymentProvider={getBillingProvider()} />
    </main>
  );
}
