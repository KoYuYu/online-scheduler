import { describe, expect, it } from "vitest";
import { buildAvailableSlots, buildPublicCalendarSlots, isTimeRangeAvailable, serializePublicSlots } from "@/lib/availability";
import type { AvailabilityRule, Booking, PublicSlot } from "@/lib/types";

describe("serializePublicSlots", () => {
  it("keeps public availability free of booking details", () => {
    const slots: PublicSlot[] = [
      {
        id: "slot-1",
        startAtUtc: "2026-06-17T23:30:00.000Z",
        endAtUtc: "2026-06-18T00:30:00.000Z",
        dateKey: "2026-06-17",
        dateLabel: "Jun 17",
        weekdayLabel: "Wed",
        timeLabel: "7:30 PM - 8:30 PM ET",
      },
    ];
    const serialized = serializePublicSlots(slots);
    expect(serialized[0]).toEqual({ ...slots[0], status: "available" });
    expect(JSON.stringify(serialized)).not.toContain("bookerEmail");
    expect(JSON.stringify(serialized)).not.toContain("zoomJoinUrl");
    expect(JSON.stringify(serialized)).not.toContain("rawInviteText");
  });

  it("builds default evening slots from 8 PM through midnight Eastern", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-mon-20-24",
        weekday: 1,
        startTimeLocal: "20:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];

    const slots = buildAvailableSlots(rules, [], "2026-06-22", "2026-06-22");
    expect(slots).toHaveLength(7);
    expect(slots.map((slot) => slot.timeLabel)).toEqual([
      "8:00 PM - 9:00 PM ET",
      "8:30 PM - 9:30 PM ET",
      "9:00 PM - 10:00 PM ET",
      "9:30 PM - 10:30 PM ET",
      "10:00 PM - 11:00 PM ET",
      "10:30 PM - 11:30 PM ET",
      "11:00 PM - 12:00 AM ET",
    ]);
  });

  it("builds weekend morning and evening slots", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-sat-10-13",
        weekday: 6,
        startTimeLocal: "10:00",
        endTimeLocal: "13:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
      {
        id: "default-sat-19-24",
        weekday: 6,
        startTimeLocal: "19:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];

    const slots = buildAvailableSlots(rules, [], "2026-06-20", "2026-06-20");
    const labels = slots.map((slot) => slot.timeLabel);
    expect(slots).toHaveLength(14);
    expect(labels).toContain("10:00 AM - 11:00 AM ET");
    expect(labels).toContain("10:30 AM - 11:30 AM ET");
    expect(labels).toContain("12:00 PM - 1:00 PM ET");
    expect(labels).toContain("7:00 PM - 8:00 PM ET");
    expect(labels).toContain("10:30 PM - 11:30 PM ET");
    expect(labels).toContain("11:00 PM - 12:00 AM ET");
    expect(labels).not.toContain("11:30 PM - 12:30 AM ET");
  });

  it("keeps one-hour slots that do not overlap an off-hour Zoom booking", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-wed-20-24",
        weekday: 3,
        startTimeLocal: "20:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];
    const bookings: Booking[] = [
      {
        id: "booking-1",
        source: "zoom",
        title: "Oscar - Jason- system design",
        startAtUtc: "2026-06-18T02:15:00.000Z",
        endAtUtc: "2026-06-18T03:15:00.000Z",
        bookerName: null,
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
        status: "confirmed",
        createdAt: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ];

    const labels = buildAvailableSlots(rules, bookings, "2026-06-17", "2026-06-17").map((slot) => slot.timeLabel);

    expect(labels).toContain("9:00 PM - 10:00 PM ET");
    expect(labels).not.toContain("9:30 PM - 10:30 PM ET");
    expect(labels).not.toContain("10:00 PM - 11:00 PM ET");
    expect(labels).not.toContain("11:00 PM - 12:00 AM ET");
    expect(labels).toEqual([
      "8:00 PM - 9:00 PM ET",
      "8:30 PM - 9:30 PM ET",
      "9:00 PM - 10:00 PM ET",
    ]);
  });

  it("returns anonymous blocked slots for the public calendar", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-wed-20-24",
        weekday: 3,
        startTimeLocal: "20:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];
    const bookings: Booking[] = [
      {
        id: "booking-1",
        source: "zoom",
        title: "Oscar - Jason- system design",
        startAtUtc: "2026-06-18T02:15:00.000Z",
        endAtUtc: "2026-06-18T03:15:00.000Z",
        bookerName: "Jason",
        bookerEmail: "jason@example.com",
        notes: "private",
        invitedByName: "Oscar",
        zoomJoinUrl: "https://example.zoom.us/j/1",
        meetingId: "123",
        passcode: "secret",
        rawInviteText: "private raw invite",
        attachmentFileName: "private.pdf",
        attachmentMimeType: "application/pdf",
        attachmentDataBase64: "private-file",
        attachments: [
          {
            id: "attachment-1",
            fileName: "private.pdf",
            mimeType: "application/pdf",
            dataBase64: "private-file",
          },
        ],
        reminder24hSentAt: null,
        status: "confirmed",
        createdAt: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ];

    const publicSlots = serializePublicSlots(buildPublicCalendarSlots(rules, bookings, "2026-06-17", "2026-06-17"));
    const overlappingBookingSlot = publicSlots.find((slot) => slot.timeLabel === "10:00 PM - 11:00 PM ET");

    expect(publicSlots).toHaveLength(7);
    expect(overlappingBookingSlot?.status).toBe("blocked");
    expect(publicSlots.find((slot) => slot.timeLabel === "9:00 PM - 10:00 PM ET")?.status).toBe("available");
    expect(JSON.stringify(publicSlots)).not.toContain("jason@example.com");
    expect(JSON.stringify(publicSlots)).not.toContain("example.zoom.us");
    expect(JSON.stringify(publicSlots)).not.toContain("private raw invite");
    expect(JSON.stringify(publicSlots)).not.toContain("private-file");
  });

  it("allows parsed Zoom meetings that start off the hour but stay inside an availability window", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-wed-20-24",
        weekday: 3,
        startTimeLocal: "20:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];

    expect(isTimeRangeAvailable(rules, [], "2026-06-18T02:15:00.000Z", "2026-06-18T03:15:00.000Z")).toBe(true);
    expect(isTimeRangeAvailable(rules, [], "2026-06-18T03:30:00.000Z", "2026-06-18T04:30:00.000Z")).toBe(false);
  });

  it("blocks arbitrary Zoom ranges that overlap an existing booking", () => {
    const rules: AvailabilityRule[] = [
      {
        id: "default-wed-20-24",
        weekday: 3,
        startTimeLocal: "20:00",
        endTimeLocal: "24:00",
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      },
    ];
    const bookings: Booking[] = [
      {
        id: "booking-1",
        source: "manual",
        title: "Existing booking",
        startAtUtc: "2026-06-18T02:00:00.000Z",
        endAtUtc: "2026-06-18T03:00:00.000Z",
        bookerName: "Existing",
        bookerEmail: "existing@example.com",
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
        status: "confirmed",
        createdAt: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ];

    expect(isTimeRangeAvailable(rules, bookings, "2026-06-18T02:15:00.000Z", "2026-06-18T03:15:00.000Z")).toBe(false);
  });
});
