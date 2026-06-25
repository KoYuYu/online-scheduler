import { NextRequest, NextResponse } from "next/server";
import { attachmentErrorMessage, sanitizeAttachment } from "@/lib/attachments";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/storage";
import type { Booking, BookingInput } from "@/lib/types";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type AdminBookingPatch = Partial<BookingInput & { status: Booking["status"]; clearAttachment: boolean }>;

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
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AdminBookingPatch;
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ error: "請填寫主題。" }, { status: 400 });
    }
    if (body.startAtUtc && Number.isNaN(new Date(body.startAtUtc).getTime())) {
      return NextResponse.json({ error: "開始時間格式不正確。" }, { status: 400 });
    }
    if (body.endAtUtc && Number.isNaN(new Date(body.endAtUtc).getTime())) {
      return NextResponse.json({ error: "結束時間格式不正確。" }, { status: 400 });
    }
    if (body.startAtUtc && body.endAtUtc && new Date(body.startAtUtc).getTime() >= new Date(body.endAtUtc).getTime()) {
      return NextResponse.json({ error: "結束時間必須晚於開始時間。" }, { status: 400 });
    }

    const hasAttachmentInput =
      body.clearAttachment ||
      body.attachmentFileName !== undefined ||
      body.attachmentMimeType !== undefined ||
      body.attachmentDataBase64 !== undefined;
    const attachment = body.clearAttachment
      ? { attachmentFileName: null, attachmentMimeType: null, attachmentDataBase64: null }
      : hasAttachmentInput
        ? sanitizeAttachment(body)
        : {};
    const patch: Partial<BookingInput & { status: Booking["status"] }> = { ...attachment };
    if ("source" in body) patch.source = body.source;
    if ("title" in body) patch.title = body.title?.trim();
    if ("startAtUtc" in body) patch.startAtUtc = body.startAtUtc;
    if ("endAtUtc" in body) patch.endAtUtc = body.endAtUtc;
    if ("bookerName" in body) patch.bookerName = body.bookerName?.trim() || null;
    if ("bookerEmail" in body) patch.bookerEmail = body.bookerEmail?.trim() || null;
    if ("notes" in body) patch.notes = body.notes?.trim() || null;
    if ("invitedByName" in body) patch.invitedByName = body.invitedByName?.trim() || null;
    if ("zoomJoinUrl" in body) patch.zoomJoinUrl = body.zoomJoinUrl?.trim() || null;
    if ("meetingId" in body) patch.meetingId = body.meetingId?.trim() || null;
    if ("passcode" in body) patch.passcode = body.passcode?.trim() || null;
    if ("rawInviteText" in body) patch.rawInviteText = body.rawInviteText?.trim() || null;
    if ("status" in body) patch.status = body.status;

    const booking = await getStore().updateBooking(id, patch);
    if (!booking) {
      return NextResponse.json({ error: "找不到資料。" }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (error) {
    const attachmentMessage = attachmentErrorMessage(error);
    if (attachmentMessage) {
      return NextResponse.json({ error: attachmentMessage }, { status: 400 });
    }
    const message = error instanceof Error && error.message === "BOOKING_CONFLICT" ? "這個時段與其他預約衝突。" : "無法更新預約。";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
