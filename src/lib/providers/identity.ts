import type { ProviderId } from "@/lib/providers/config";

/** Infer the delivery adapter from the ad-platform macro configured for its click ID. */
export function inferProviderIdFromTokenMacro(token: string): ProviderId | undefined {
  const normalized = token.trim().toLowerCase();
  if (normalized === "${subid}") return "propeller";
  if (normalized === "{aclid}") return "trafficjunky";
  if (normalized === "{click_id}" || normalized === "{clickid}") return "trafficstars";
  return undefined;
}
