import { NextResponse } from "next/server";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  if (LEGACY_SESSION_COOKIE !== SESSION_COOKIE) {
    response.cookies.set(LEGACY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}
