import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const body = await request.json();
  const rule = await getStore().createAvailabilityRule({
    weekday: Number(body.weekday),
    startTimeLocal: body.startTimeLocal,
    endTimeLocal: body.endTimeLocal,
    slotMinutes: 60,
    timezone: "America/New_York",
    isActive: body.isActive !== false,
  });
  return NextResponse.json({ rule });
}
