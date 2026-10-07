import type { Metadata } from "next";

import AdminVerificationPage from "@/app/admin/page";

export const metadata: Metadata = {
  title: "Verification | Track.in",
  description: "Private click and conversion verification.",
};

export const dynamic = "force-dynamic";

export default AdminVerificationPage;
