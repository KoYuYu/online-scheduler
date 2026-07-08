import { describe, expect, it, vi } from "vitest";
import { recordNotificationLog } from "@/lib/notification-log";
import type { NotificationLogInput } from "@/lib/types";

describe("recordNotificationLog", () => {
  it("truncates long details before writing", async () => {
    const created: NotificationLogInput[] = [];
    const store = {
      createNotificationLog: async (input: NotificationLogInput) => {
        created.push(input);
      },
    };

    await recordNotificationLog(store, {
      bookingId: "booking-1",
      kind: "booking_created",
      channel: "email",
      status: "failed",
      detail: "x".repeat(1100),
    });

    expect(created[0].detail).toHaveLength(1000);
  });

  it("does not throw when log writing fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = {
      createNotificationLog: async () => {
        throw new Error("database unavailable");
      },
    };

    await expect(
      recordNotificationLog(store, {
        bookingId: "booking-1",
        kind: "reminder_24h",
        channel: "push",
        status: "failed",
        detail: "push failed",
      })
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });
});
