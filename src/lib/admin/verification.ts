import { prisma } from "@/lib/database/prisma";

export async function getVerificationSnapshot(ownerId?: string) {
  const [clickCount, conversionCount, pendingDeliveryCount, recentClicks, recentConversions] =
    await Promise.all([
      prisma.click.count({ where: ownerId ? { campaign: { ownerId } } : undefined }),
      prisma.conversion.count({ where: ownerId ? { click: { campaign: { ownerId } } } : undefined }),
      prisma.outboundPostback.count({
        where: {
          status: { in: ["pending", "processing", "retryable_failed"] },
          ...(ownerId ? { conversion: { click: { campaign: { ownerId } } } } : {}),
        },
      }),
      prisma.click.findMany({
        where: ownerId ? { campaign: { ownerId } } : undefined,
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
        where: ownerId ? { click: { campaign: { ownerId } } } : undefined,
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
