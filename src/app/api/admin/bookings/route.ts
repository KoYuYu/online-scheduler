import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { attachmentErrorMessage, sanitizeAttachments } from "@/lib/attachments";
import { queueBookingCreatedPushAndMarkCoveredReminders } from "@/lib/reminders";
import { getStore } from "@/lib/storage";
import type { BookingInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as BookingInput;
    if (!body.startAtUtc || !body.endAtUtc || !body.title) {
      return NextResponse.json({ error: "缺少預約資訊。" }, { status: 400 });
    }
    const attachments = sanitizeAttachments(body);
    const booking = await getStore().createBooking({
      source: body.source || "admin",
      title: body.title,
      startAtUtc: body.startAtUtc,
      endAtUtc: body.endAtUtc,
      bookerName: body.bookerName || null,
      bookerEmail: body.bookerEmail || null,
      notes: body.notes || null,
      invitedByName: body.invitedByName || null,
      zoomJoinUrl: body.zoomJoinUrl || null,
      meetingId: body.meetingId || null,
      passcode: body.passcode || null,
      rawInviteText: body.rawInviteText || null,
      attachments,
    });
    queueBookingCreatedPushAndMarkCoveredReminders(booking);
    return NextResponse.json({ booking });
  } catch (error) {
    const attachmentMessage = attachmentErrorMessage(error);
    if (attachmentMessage) {
      return NextResponse.json({ error: attachmentMessage }, { status: 400 });
    }
    const message = error instanceof Error && error.message === "BOOKING_CONFLICT" ? "這個時段與其他預約衝突。" : "無法建立預約。";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
