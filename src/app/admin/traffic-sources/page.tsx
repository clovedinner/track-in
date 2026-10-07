import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/database/prisma";
import AdminNavigation from "@/app/admin/admin-navigation";
import TrafficSourceCreateModal from "./traffic-source-create-modal";

export const metadata: Metadata = { title: "Traffic sources | Track.in", description: "Configure ad-platform traffic sources." };
export const dynamic = "force-dynamic";

export default async function TrafficSourcesPage() {
  const sources = await prisma.trafficSource.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true, enabled: true, configuration: true } });
  const rows = await Promise.all(sources.map(async (source) => {
    const [visits, conversions, registration, ftd] = await Promise.all([
      prisma.click.count({ where: { trafficSourceId: source.id } }),
      prisma.conversion.count({ where: { click: { trafficSourceId: source.id } } }),
      prisma.conversion.count({ where: { eventType: "registration", click: { trafficSourceId: source.id } } }),
      prisma.conversion.count({ where: { eventType: "ftd", click: { trafficSourceId: source.id } } }),
    ]);
    const configuration = source.configuration && typeof source.configuration === "object" && !Array.isArray(source.configuration) ? source.configuration as Record<string, unknown> : {};
    const postbacks = configuration.postbackByEventType && typeof configuration.postbackByEventType === "object" ? configuration.postbackByEventType as Record<string, unknown> : {};
    return { ...source, visits, conversions, registration, ftd, registrationCustom: typeof postbacks.registration === "string", ftdCustom: typeof postbacks.ftd === "string" };
  }));
  return <main className="min-h-screen bg-[#f4f1ea] text-[#17202a]"><AdminNavigation pathname="/admin/traffic-sources" /><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <header className="flex flex-col gap-5 border-b border-[#c8c3b8] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f2d] hover:underline">Track.in / private</Link><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Traffic sources</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#59636c]">Connect a traffic source and preserve the tokens needed for attribution.</p></div><TrafficSourceCreateModal /></header>
    <section className="mt-8 overflow-x-auto border border-[#c8c3b8] bg-[#faf8f3]" aria-label="Traffic source performance"><table className="w-full min-w-[920px] border-collapse text-left text-sm"><thead className="bg-[#e8e3d9] text-xs uppercase tracking-[0.1em] text-[#59636c]"><tr>{["Name", "Status", "Visits", "Conversions", "Error", "Registration", "FTD"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#59636c]">No traffic sources configured yet.</td></tr> : rows.map((row) => <tr key={row.id} className="border-t border-[#ded9cf]"><td className="px-4 py-4"><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-[#59636c]">{row.type}</p></td><td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold ${row.enabled ? "bg-[#dcebdc] text-[#285b38]" : "bg-[#ebe7dc] text-[#6c5a2f]"}`}>{row.enabled ? "Active" : "Paused"}</span></td><td className="px-4 py-4">{row.visits.toLocaleString()}</td><td className="px-4 py-4">{row.conversions.toLocaleString()}</td><td className="px-4 py-4 text-[#59636c]">0</td><td className="px-4 py-4">{row.registration.toLocaleString()} {row.registrationCustom ? <span className="ml-1 text-xs text-[#a34f2d]">custom</span> : null}</td><td className="px-4 py-4">{row.ftd.toLocaleString()} {row.ftdCustom ? <span className="ml-1 text-xs text-[#a34f2d]">custom</span> : null}</td></tr>)}</tbody></table></section>
  </div></main>;
}
