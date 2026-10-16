import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";
import { isValidTimezone } from "@/lib/timezone";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const timezone = typeof body === "object" && body !== null && "timezone" in body ? (body as { timezone?: unknown }).timezone : undefined;
  if (typeof timezone !== "string" || timezone.length > 64 || !isValidTimezone(timezone)) return NextResponse.json({ error: "Choose a valid IANA timezone." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  return NextResponse.json({ timezone });
}
