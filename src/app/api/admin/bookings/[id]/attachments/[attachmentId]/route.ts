import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(request: NextRequest, context: Params) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  const { id, attachmentId } = await context.params;
  const attachment = await getStore().getBookingAttachment(id, attachmentId);
  if (!attachment?.dataBase64) {
    return NextResponse.json({ error: "找不到附件。" }, { status: 404 });
  }
  const encodedFileName = encodeURIComponent(attachment.fileName).replace(/'/g, "%27");
  return new Response(Buffer.from(attachment.dataBase64, "base64"), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
