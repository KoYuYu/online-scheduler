import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: Params) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await getStore().deleteBooking(id);
  return NextResponse.json({ deleted });
}

export async function PATCH(request: NextRequest, context: Params) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const booking = await getStore().updateBooking(id, body);
  if (!booking) {
    return NextResponse.json({ error: "找不到資料。" }, { status: 404 });
  }
  return NextResponse.json({ booking });
}
