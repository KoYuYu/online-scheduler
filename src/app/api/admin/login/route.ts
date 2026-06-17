import { NextResponse } from "next/server";
import { createSession, defaultAdminEmail, defaultAdminPassword, ensureAdminBootstrap, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const envEmail = defaultAdminEmail().toLowerCase();
    const envPassword = defaultAdminPassword();
    if (envEmail && envPassword && body.email?.toLowerCase() === envEmail && body.password === envPassword) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(SESSION_COOKIE, createSession(envEmail), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    await ensureAdminBootstrap();
    const user = body.email ? await getStore().getAdminByEmail(body.email) : null;
    if (!user || !body.password || !verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ error: "帳號或密碼錯誤。" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSession(user.email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    console.error("[admin/login] POST failed:", error);
    return NextResponse.json({ error: "登入失敗。" }, { status: 500 });
  }
}
