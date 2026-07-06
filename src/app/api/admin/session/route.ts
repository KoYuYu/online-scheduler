import { NextRequest, NextResponse } from "next/server";
import { createSession, getAdminSession, getAdminSessionMaxAgeSeconds, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const response = NextResponse.json({
    email: session.email,
    sessionMaxAgeSeconds: getAdminSessionMaxAgeSeconds(),
  });
  response.cookies.set(SESSION_COOKIE, createSession(session.email), sessionCookieOptions());
  return response;
}
