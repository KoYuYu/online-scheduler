import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { decodeBookingCursor, encodeBookingCursor } from "@/lib/booking-pagination";
import { getStore } from "@/lib/storage";
import type { BookingPageScope } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope: BookingPageScope = url.searchParams.get("scope") === "past" ? "past" : "upcoming";
  const requestedLimit = Number(url.searchParams.get("limit") || 30);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 30;
  const cursor = decodeBookingCursor(url.searchParams.get("cursor"));
  const store = getStore();
  await store.ensureDefaultAvailability();
  const [page, rules] = await Promise.all([
    store.listBookingPage({ scope, limit, cursor, now: new Date().toISOString() }),
    store.listAvailabilityRules(),
  ]);
  return NextResponse.json({
    bookings: page.bookings,
    nextCursor: encodeBookingCursor(page.nextCursor),
    total: page.total,
    rules,
  });
}
