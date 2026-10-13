import { NextResponse } from "next/server";

import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ status: "signed_out" });
  response.cookies.set(sessionCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
