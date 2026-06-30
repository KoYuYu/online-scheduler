import { describe, expect, it } from "vitest";
import { buildBookingCreatedPushPayload } from "@/lib/push";
import { getCreatedBookingCoveredReminderKinds, getMostUrgentDueReminderKind } from "@/lib/reminders";
import type { Booking } from "@/lib/types";

function bookingAt(startAtUtc: string): Booking {
  const endAtUtc = new Date(new Date(startAtUtc).getTime() + 60 * 60 * 1000).toISOString();
  return {
    id: "booking-1",
    source: "manual",
    title: "System design interview",
    startAtUtc,
    endAtUtc,
    bookerName: "Jason",
    bookerEmail: null,
    notes: null,
    invitedByName: null,
    zoomJoinUrl: null,
    meetingId: null,
    passcode: null,
    rawInviteText: null,
    attachmentFileName: null,
    attachmentMimeType: null,
    attachmentDataBase64: null,
    attachments: [],
    reminder24hSentAt: null,
    reminder24hLastError: null,
    reminder1hSentAt: null,
    reminder1hLastError: null,
    status: "confirmed",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  };
}

describe("booking reminder dedupe", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("marks only the 24h reminder as covered for new bookings inside 24 hours", () => {
    const booking = bookingAt("2026-07-01T00:00:00.000Z");

    expect(getCreatedBookingCoveredReminderKinds(booking, now)).toEqual(["24h"]);
    expect(getMostUrgentDueReminderKind(booking, now)).toBe("24h");
    expect(buildBookingCreatedPushPayload(booking, now).title).toBe("新預約，24 小時內開始：System design interview");
  });

  it("uses the 1h reminder as the only immediate reminder when both reminder windows are due", () => {
    const booking = bookingAt("2026-06-30T12:30:00.000Z");

    expect(getCreatedBookingCoveredReminderKinds(booking, now)).toEqual(["24h", "1h"]);
    expect(getMostUrgentDueReminderKind(booking, now)).toBe("1h");
    expect(buildBookingCreatedPushPayload(booking, now).title).toBe("新預約，即將開始：System design interview");
  });

  it("does not cover reminder windows for new bookings more than 24 hours away", () => {
    const booking = bookingAt("2026-07-02T12:30:00.000Z");

    expect(getCreatedBookingCoveredReminderKinds(booking, now)).toEqual([]);
    expect(getMostUrgentDueReminderKind(booking, now)).toBeNull();
    expect(buildBookingCreatedPushPayload(booking, now).title).toBe("新預約：System design interview");
  });
});
