import { prisma } from "@/lib/database/prisma";

export async function accountCanUseApi(ownerId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId: ownerId, status: "active", plan: { in: ["Operator", "Expanded"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return subscription !== null;
}
