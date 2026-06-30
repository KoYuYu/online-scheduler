import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getStore } from "@/lib/storage";

export const SESSION_COOKIE = "scheduler_admin";

function secret(): string {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

export function defaultAdminEmail(): string {
  return process.env.ADMIN_EMAIL || "";
}

export function defaultAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(email: string): string {
  const payload = base64Url(JSON.stringify({ email, exp: Date.now() + 1000 * 60 * 60 * 12 }));
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token?: string): { email: string } | null {
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email: string; exp: number };
  if (!parsed.email || parsed.exp < Date.now()) {
    return null;
  }
  return { email: parsed.email };
}

export function getAdminSession(request: NextRequest): { email: string } | null {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function ensureAdminBootstrap(): Promise<void> {
  const store = getStore();
  const count = await store.countAdminUsers();
  if (count > 0) {
    return;
  }

  const email = defaultAdminEmail();
  const password = defaultAdminPassword();
  if (email && password) {
    await store.createAdminUser(email, hashPassword(password));
  }
}
