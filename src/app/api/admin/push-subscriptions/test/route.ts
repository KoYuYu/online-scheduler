import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { sendAdminPushNotification } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }

  const result = await sendAdminPushNotification({
    title: "預約系統推送測試",
    body: "這台裝置已成功啟用管理員推送。",
    url: "/admin",
    tag: "online-scheduler-push-test",
    kind: "test",
  });

  return NextResponse.json(result, { status: result.sent > 0 ? 200 : 409 });
}
