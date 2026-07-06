import { NextRequest, NextResponse } from "next/server";
import { createSession, defaultAdminEmail, defaultAdminPassword, ensureAdminBootstrap, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { clearRateLimit, consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

const loginWindowMs = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  const clientIp = getClientIp(request);
  const emailKey = body.email?.trim().toLowerCase() || "unknown";
  const ipLimit = consumeRateLimit({ key: `admin-login-ip:${clientIp}`, limit: 30, windowMs: loginWindowMs });
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit, "登入嘗試太頻繁，請稍後再試。");
  }
  const accountLimitKey = `admin-login-account:${clientIp}:${emailKey}`;
  const accountLimit = consumeRateLimit({ key: accountLimitKey, limit: 8, windowMs: loginWindowMs });
  if (!accountLimit.allowed) {
    return rateLimitResponse(accountLimit, "登入嘗試太頻繁，請稍後再試。");
  }

  const envEmail = defaultAdminEmail().toLowerCase();
  const envPassword = defaultAdminPassword();
  if (envEmail && envPassword && body.email?.toLowerCase() === envEmail && body.password === envPassword) {
    clearRateLimit(accountLimitKey);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSession(envEmail), sessionCookieOptions());
    return response;
  }

  await ensureAdminBootstrap();
  const user = body.email ? await getStore().getAdminByEmail(body.email) : null;
  if (!user || !body.password || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "帳號或密碼錯誤。" }, { status: 401 });
  }

  clearRateLimit(accountLimitKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSession(user.email), sessionCookieOptions());
  return response;
}
