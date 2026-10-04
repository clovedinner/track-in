import { prisma } from "@/lib/database/prisma";

export async function getVerificationSnapshot() {
  const [clickCount, conversionCount, pendingDeliveryCount, recentClicks, recentConversions] =
    await Promise.all([
      prisma.click.count(),
      prisma.conversion.count(),
      prisma.outboundPostback.count({
        where: {
          status: { in: ["pending", "processing", "retryable_failed"] },
        },
      }),
      prisma.click.findMany({
        orderBy: { clickedAt: "desc" },
        take: 12,
        select: {
          clickId: true,
          clickedAt: true,
          campaign: { select: { name: true, slug: true } },
          trackingTokens: true,
        },
      }),
      prisma.conversion.findMany({
        orderBy: { receivedAt: "desc" },
        take: 12,
        select: {
          id: true,
          eventType: true,
          eventId: true,
          receivedAt: true,
          valueMinor: true,
          currency: true,
          validationState: true,
          click: { select: { clickId: true, campaign: { select: { name: true } } } },
          outboundPostbacks: { select: { status: true } },
        },
      }),
    ]);

  return {
    clickCount,
    conversionCount,
    pendingDeliveryCount,
    recentClicks,
    recentConversions,
  };
}
