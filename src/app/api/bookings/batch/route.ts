import { NextRequest, NextResponse } from "next/server";
import { attachmentErrorMessage, sanitizeAttachments } from "@/lib/attachments";
import { buildAvailableSlots, isPastStart, overlaps, serializePublicSlots } from "@/lib/availability";
import { queueNotificationJobProcessing } from "@/lib/notification-jobs";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getStore } from "@/lib/storage";
import { addDaysToYmd, formatYmd, localYmdTimeToUtc } from "@/lib/time";
import type { BookingInput } from "@/lib/types";

export const runtime = "nodejs";

type BatchSlotInput = { startAtUtc?: string; endAtUtc?: string };
type BatchBookingBody = Partial<BookingInput> & { slots?: BatchSlotInput[] };

function isValidZoomUrl(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.toLowerCase().endsWith("zoom.us");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const bookingLimit = consumeRateLimit({
      key: `public-booking-batch:${getClientIp(request)}`,
      limit: 5,
      windowMs: 30 * 60 * 1000,
    });
    if (!bookingLimit.allowed) {
      return rateLimitResponse(bookingLimit, "預約送出太頻繁，請稍後再試。");
    }

    const body = (await request.json()) as BatchBookingBody;
    const slots = Array.isArray(body.slots) ? body.slots : [];
    if (!slots.length || slots.length > 8) {
      return NextResponse.json({ error: "一次請選擇 1 到 8 個時段。" }, { status: 400 });
    }
    if (!body.bookerName?.trim()) {
      return NextResponse.json({ error: "請填寫姓名。" }, { status: 400 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "請填寫會議主題。" }, { status: 400 });
    }
    const zoomJoinUrl = body.zoomJoinUrl?.trim() || null;
    if (!isValidZoomUrl(zoomJoinUrl)) {
      return NextResponse.json({ error: "Zoom 連結格式不正確。" }, { status: 400 });
    }

    const normalizedSlots = slots.map((slot) => ({
      startAtUtc: slot.startAtUtc || "",
      endAtUtc: slot.endAtUtc || "",
    }));
    const now = new Date();
    for (const slot of normalizedSlots) {
      const start = new Date(slot.startAtUtc);
      const end = new Date(slot.endAtUtc);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() >= end.getTime()) {
        return NextResponse.json({ error: "預約時間格式不正確。" }, { status: 400 });
      }
      if (isPastStart(slot.startAtUtc, now)) {
        return NextResponse.json({ error: "不能預約已經過去或已開始的時間。" }, { status: 409 });
      }
    }
    for (let leftIndex = 0; leftIndex < normalizedSlots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < normalizedSlots.length; rightIndex += 1) {
        const left = normalizedSlots[leftIndex];
        const right = normalizedSlots[rightIndex];
        if (overlaps(left.startAtUtc, left.endAtUtc, right.startAtUtc, right.endAtUtc)) {
          return NextResponse.json({ error: "選取的時段彼此重疊，請調整後再預約。" }, { status: 400 });
        }
      }
    }

    const store = getStore();
    await store.ensureDefaultAvailability();
    const sorted = [...normalizedSlots].sort((left, right) => left.startAtUtc.localeCompare(right.startAtUtc));
    if (new Date(sorted[sorted.length - 1].startAtUtc).getTime() - new Date(sorted[0].startAtUtc).getTime() > 28 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "批次預約的時段必須在 28 天範圍內。" }, { status: 400 });
    }
    const fromYmd = formatYmd(new Date(sorted[0].startAtUtc));
    const toYmd = formatYmd(new Date(sorted[sorted.length - 1].startAtUtc));
    const fromUtc = localYmdTimeToUtc(fromYmd, "00:00", "America/New_York").toISOString();
    const toUtc = localYmdTimeToUtc(addDaysToYmd(toYmd, 1), "00:00", "America/New_York").toISOString();
    const [rules, existingBookings] = await Promise.all([store.listAvailabilityRules(), store.listBookings(fromUtc, toUtc)]);
    const availableSlots = buildAvailableSlots(rules, existingBookings, fromYmd, toYmd, { excludePast: true, now });
    const allAvailable = normalizedSlots.every((selected) =>
      availableSlots.some((available) => available.startAtUtc === selected.startAtUtc && available.endAtUtc === selected.endAtUtc)
    );
    if (!allAvailable) {
      return NextResponse.json(
        { error: "其中一個時段已不可預約，尚未建立任何預約。", suggestions: serializePublicSlots(availableSlots.slice(0, 6)) },
        { status: 409 }
      );
    }

    const attachments = sanitizeAttachments(body);
    const inputs: BookingInput[] = normalizedSlots.map((slot) => ({
      source: "manual",
      title: body.title!.trim(),
      startAtUtc: slot.startAtUtc,
      endAtUtc: slot.endAtUtc,
      bookerName: body.bookerName!.trim(),
      bookerEmail: null,
      notes: body.notes?.trim() || null,
      zoomJoinUrl,
      attachments,
    }));
    const bookings = await store.createBookings(inputs, { notificationChannels: ["email", "push"] });
    queueNotificationJobProcessing();

    return NextResponse.json({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        startAtUtc: booking.startAtUtc,
        endAtUtc: booking.endAtUtc,
      })),
      notifications: { queued: true },
    });
  } catch (error) {
    const attachmentMessage = attachmentErrorMessage(error);
    if (attachmentMessage) {
      return NextResponse.json({ error: attachmentMessage }, { status: 400 });
    }
    const conflict = error instanceof Error && ["BOOKING_CONFLICT", "BOOKING_INPUT_OVERLAP"].includes(error.message);
    return NextResponse.json(
      { error: conflict ? "其中一個時段剛剛已被預約，尚未建立任何預約。" : "預約失敗。" },
      { status: conflict ? 409 : 500 }
    );
  }
}
