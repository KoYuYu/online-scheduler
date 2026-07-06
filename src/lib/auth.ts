import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getStore } from "@/lib/storage";

const devOnlySecret = "dev-only-change-me";
export const LEGACY_SESSION_COOKIE = "scheduler_admin";
export const SESSION_COOKIE = isProductionRuntime() ? "__Host-scheduler_admin" : LEGACY_SESSION_COOKIE;
const defaultSessionMaxAgeSeconds = 60 * 60 * 24 * 180;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME);
}

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (isProductionRuntime()) {
    if (!value || value === devOnlySecret || value.length < 32) {
      throw new Error("AUTH_SECRET must be set to a unique value of at least 32 characters in production.");
    }
    return value;
  }
  return value || devOnlySecret;
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

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAdminSessionMaxAgeSeconds(): number {
  const value = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || defaultSessionMaxAgeSeconds);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : defaultSessionMaxAgeSeconds;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isProductionRuntime(),
    path: "/",
    maxAge: getAdminSessionMaxAgeSeconds(),
  };
}

export function createSession(email: string): string {
  const payload = base64Url(JSON.stringify({ email, exp: Date.now() + 1000 * getAdminSessionMaxAgeSeconds() }));
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token?: string): { email: string } | null {
  if (!token) {
    return null;
  }
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(sign(payload), signature)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email: string; exp: number };
    if (!parsed.email || parsed.exp < Date.now()) {
      return null;
    }
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export function getAdminSession(request: NextRequest): { email: string } | null {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value || request.cookies.get(LEGACY_SESSION_COOKIE)?.value);
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
