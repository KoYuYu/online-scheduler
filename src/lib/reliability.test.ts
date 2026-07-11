import { describe, expect, it } from "vitest";
import { decodeBookingCursor, encodeBookingCursor } from "@/lib/booking-pagination";
import { getNotificationRetryDelayMinutes } from "@/lib/notification-jobs";
import { buildBookingBatchCreatedPushPayload } from "@/lib/push";
import type { Booking } from "@/lib/types";

function booking(id: string, startAtUtc: string): Booking {
  return {
    id,
    source: "manual",
    title: "System design interview",
    startAtUtc,
    endAtUtc: new Date(new Date(startAtUtc).getTime() + 60 * 60 * 1000).toISOString(),
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
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  };
}

describe("booking reliability helpers", () => {
  it("round-trips opaque admin booking cursors", () => {
    const cursor = { startAtUtc: "2026-07-11T12:00:00.000Z", id: "booking-1" };
    expect(decodeBookingCursor(encodeBookingCursor(cursor))).toEqual(cursor);
    expect(decodeBookingCursor("not-a-cursor")).toBeNull();
  });

  it("backs notification jobs off and caps the retry delay", () => {
    expect(getNotificationRetryDelayMinutes(1)).toBe(1);
    expect(getNotificationRetryDelayMinutes(4)).toBe(30);
    expect(getNotificationRetryDelayMinutes(99)).toBe(720);
  });

  it("builds one summary push for a multi-slot booking", () => {
    const payload = buildBookingBatchCreatedPushPayload([
      booking("booking-2", "2026-07-12T02:00:00.000Z"),
      booking("booking-1", "2026-07-11T02:00:00.000Z"),
    ]);
    expect(payload.title).toBe("新增 2 個預約：System design interview");
    expect(payload.tag).toBe("booking-created-batch-booking-1");
    expect(payload.body).toContain("2026");
  });
});
