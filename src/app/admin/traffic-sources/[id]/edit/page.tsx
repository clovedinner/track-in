import { notFound } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import TrafficSourceCreateModal from "../../traffic-source-create-modal";
import { requireCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function EditTrafficSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const source = await prisma.trafficSource.findUnique({ where: { id: (await params).id, ownerId: user.id }, select: { id: true, name: true, type: true, enabled: true, configuration: true } });
  if (!source) notFound();
  return <TrafficSourceCreateModal source={{ ...source, configuration: source.configuration as Record<string, unknown> }} />;
}
