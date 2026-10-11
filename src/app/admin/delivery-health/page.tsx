import type { Metadata } from "next";

import DeliveryHealthClient from "./delivery-health-client";

export const metadata: Metadata = {
  title: "Delivery health | Trakio",
  description: "Private outbound postback delivery health.",
};

export default function DeliveryHealthPage() {
  return <DeliveryHealthClient />;
}
