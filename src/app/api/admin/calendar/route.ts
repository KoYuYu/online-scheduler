import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  try {
    const store = getStore();
    await store.ensureDefaultAvailability();
    const [bookings, rules] = await Promise.all([store.listBookings(), store.listAvailabilityRules()]);
    return NextResponse.json({ bookings, rules });
  } catch (error) {
    console.error("[admin/calendar] GET failed:", error);
    return NextResponse.json({ error: "無法取得行事曆資料。" }, { status: 500 });
  }
}
