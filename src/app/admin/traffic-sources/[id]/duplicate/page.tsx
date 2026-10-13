import { notFound } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import TrafficSourceCreateModal from "../../traffic-source-create-modal";

export const dynamic = "force-dynamic";

export default async function DuplicateTrafficSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const source = await prisma.trafficSource.findUnique({ where: { id: (await params).id }, select: { id: true, name: true, type: true, enabled: true, configuration: true } });
  if (!source) notFound();
  return <TrafficSourceCreateModal source={{ ...source, configuration: source.configuration as Record<string, unknown> }} duplicate />;
}
