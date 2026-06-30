import { NextResponse } from "next/server";
import { attachmentErrorMessage, sanitizeAttachments } from "@/lib/attachments";
import { buildAvailableSlots, findMatchingSlot, isPastStart, isTimeRangeAvailable, normalizeRange, serializePublicSlots } from "@/lib/availability";
import { queueBookingNotification } from "@/lib/email";
import { queueBookingCreatedPush } from "@/lib/push";
import { queueBookingReminderIfDue } from "@/lib/reminders";
import { getStore } from "@/lib/storage";
import { addDaysToYmd, formatYmd, localYmdTimeToUtc } from "@/lib/time";
import { isSupportedZoomTimeZone, type BookingInput } from "@/lib/types";
import { parseZoomInvite } from "@/lib/zoom-parser";

export const runtime = "nodejs";

function isValidZoomUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.toLowerCase().endsWith("zoom.us");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BookingInput> & { rawInviteText?: string; sourceTimeZone?: string };
    const attachments = sanitizeAttachments(body);

    let input: BookingInput;
    if (body.source === "zoom") {
      const sourceTimeZone = body.sourceTimeZone?.trim();
      if (sourceTimeZone && !isSupportedZoomTimeZone(sourceTimeZone)) {
        return NextResponse.json({ error: "不支援的會議時區。" }, { status: 400 });
      }
      const parsed = parseZoomInvite(body.rawInviteText || "", undefined, sourceTimeZone);
      if (!parsed.timeZoneConfirmed) {
        return NextResponse.json({ error: "請先確認 Zoom 邀請的原始時區。" }, { status: 400 });
      }
      if (!isValidZoomUrl(parsed.zoomJoinUrl)) {
        return NextResponse.json({ error: "Zoom 邀請中找不到有效的 Zoom 連結。" }, { status: 400 });
      }
      input = {
        source: "zoom",
        title: parsed.title,
        startAtUtc: parsed.startAtUtc,
        endAtUtc: parsed.endAtUtc,
        bookerName: null,
        bookerEmail: null,
        notes: null,
        invitedByName: parsed.invitedByName,
        zoomJoinUrl: parsed.zoomJoinUrl,
        meetingId: parsed.meetingId,
        passcode: parsed.passcode,
        rawInviteText: parsed.rawInviteText,
        attachments,
      };
    } else {
      if (!body.bookerName?.trim()) {
        return NextResponse.json({ error: "請填寫姓名。" }, { status: 400 });
      }
      if (!body.startAtUtc || !body.endAtUtc) {
        return NextResponse.json({ error: "請提供開始與結束時間。" }, { status: 400 });
      }
      const zoomJoinUrl = body.zoomJoinUrl?.trim() || null;
      if (zoomJoinUrl && !isValidZoomUrl(zoomJoinUrl)) {
        return NextResponse.json({ error: "Zoom 連結格式不正確。" }, { status: 400 });
      }
      input = {
        source: "manual",
        title: body.title || "預約會議",
        startAtUtc: body.startAtUtc,
        endAtUtc: body.endAtUtc,
        bookerName: body.bookerName.trim(),
        bookerEmail: null,
        notes: body.notes || null,
        zoomJoinUrl,
        attachments,
      };
    }

    const now = new Date();
    if (isPastStart(input.startAtUtc, now)) {
      return NextResponse.json({ error: "不能預約已經過去或已開始的時間。" }, { status: 409 });
    }

    const store = getStore();
    await store.ensureDefaultAvailability();
    const ymd = formatYmd(new Date(input.startAtUtc));
    const { fromYmd, toYmd } = normalizeRange(ymd, addDaysToYmd(ymd, 7));
    const rules = await store.listAvailabilityRules();
    const fromUtc = localYmdTimeToUtc(fromYmd, "00:00", "America/New_York").toISOString();
    const toUtc = localYmdTimeToUtc(addDaysToYmd(toYmd, 1), "00:00", "America/New_York").toISOString();
    const existingBookings = await store.listBookings(fromUtc, toUtc);
    const slots = buildAvailableSlots(rules, existingBookings, fromYmd, toYmd, { excludePast: true, now });
    const available =
      input.source === "zoom"
        ? isTimeRangeAvailable(rules, existingBookings, input.startAtUtc, input.endAtUtc, { rejectPast: true, now })
        : Boolean(findMatchingSlot(slots, input.startAtUtc, input.endAtUtc));

    if (!available) {
      return NextResponse.json(
        { error: "這個時段不可預約。", suggestions: serializePublicSlots(slots.slice(0, 6)) },
        { status: 409 }
      );
    }

    const booking = await store.createBooking(input);
    queueBookingNotification(booking);
    queueBookingCreatedPush(booking);
    queueBookingReminderIfDue(booking);
    return NextResponse.json({
      booking: {
        id: booking.id,
        title: booking.title,
        startAtUtc: booking.startAtUtc,
        endAtUtc: booking.endAtUtc,
      },
      email: { queued: true },
    });
  } catch (error) {
    const attachmentMessage = attachmentErrorMessage(error);
    if (attachmentMessage) {
      return NextResponse.json({ error: attachmentMessage }, { status: 400 });
    }
    const message = error instanceof Error && error.message === "BOOKING_CONFLICT" ? "這個時段剛剛已被預約。" : "預約失敗。";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
