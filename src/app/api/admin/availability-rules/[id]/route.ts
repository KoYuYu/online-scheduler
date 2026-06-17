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
  try {
    const { id } = await context.params;
    const deleted = await getStore().deleteAvailabilityRule(id);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[admin/availability-rules/:id] DELETE failed:", error);
    return NextResponse.json({ error: "無法刪除可用規則。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rule = await getStore().updateAvailabilityRule(id, body);
    if (!rule) {
      return NextResponse.json({ error: "找不到資料。" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[admin/availability-rules/:id] PATCH failed:", error);
    return NextResponse.json({ error: "無法更新可用規則。" }, { status: 500 });
  }
}
