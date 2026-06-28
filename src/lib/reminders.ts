import { sendBookingReminder } from "@/lib/email";
import { getStore } from "@/lib/storage";
import type { Booking } from "@/lib/types";

export const reminderLookaheadMs = 24 * 60 * 60 * 1000;

type ReminderStore = {
  listBookings(fromUtc?: string, toUtc?: string): Promise<Booking[]>;
  markBookingReminder24hSent(id: string, sentAt: string): Promise<Booking | null>;
  markBookingReminder24hFailed(id: string, error: string): Promise<Booking | null>;
};

export type ReminderFailure = {
  id: string;
  title: string;
  error: string;
};

export type ReminderSent = {
  id: string;
  title: string;
  startAtUtc: string;
};

function normalizeReminderError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function isBookingReminderDue(booking: Booking, now = new Date()): boolean {
  const startTime = new Date(booking.startAtUtc).getTime();
  const nowTime = now.getTime();
  const cutoffTime = nowTime + reminderLookaheadMs;
  return (
    booking.status === "confirmed" &&
    !booking.reminder24hSentAt &&
    startTime > nowTime &&
    startTime <= cutoffTime
  );
}

export async function sendReminderForBooking(
  store: ReminderStore,
  booking: Booking,
  now = new Date()
): Promise<{ sent?: ReminderSent; failed?: ReminderFailure; skipped?: true }> {
  if (!isBookingReminderDue(booking, now)) {
    return { skipped: true };
  }

  try {
    const result = await sendBookingReminder(booking);
    if (!result.sent) {
      const error = result.reason || "email_not_sent";
      await store.markBookingReminder24hFailed(booking.id, error);
      return { failed: { id: booking.id, title: booking.title, error } };
    }
    await store.markBookingReminder24hSent(booking.id, new Date().toISOString());
    return { sent: { id: booking.id, title: booking.title, startAtUtc: booking.startAtUtc } };
  } catch (error) {
    const message = normalizeReminderError(error);
    await store.markBookingReminder24hFailed(booking.id, message);
    return { failed: { id: booking.id, title: booking.title, error: message } };
  }
}

export async function sendDueBookingReminders(store: ReminderStore, now = new Date()) {
  const cutoff = new Date(now.getTime() + reminderLookaheadMs);
  const bookings = await store.listBookings(now.toISOString(), cutoff.toISOString());
  const dueBookings = bookings.filter((booking) => isBookingReminderDue(booking, now));
  const sent: ReminderSent[] = [];
  const failed: ReminderFailure[] = [];

  for (const booking of dueBookings) {
    const result = await sendReminderForBooking(store, booking, now);
    if (result.sent) {
      sent.push(result.sent);
    }
    if (result.failed) {
      failed.push(result.failed);
    }
  }

  return {
    checked: bookings.length,
    due: dueBookings.length,
    sent,
    failed,
    window: {
      fromUtc: now.toISOString(),
      toUtc: cutoff.toISOString(),
    },
  };
}

export function queueBookingReminderIfDue(booking: Booking): void {
  if (!isBookingReminderDue(booking)) {
    return;
  }

  void sendReminderForBooking(getStore(), booking)
    .then((result) => {
      if (result.sent) {
        console.log("24 小時預約提醒已送出。", { bookingId: booking.id });
      }
      if (result.failed) {
        console.error("24 小時預約提醒寄送失敗。", result.failed);
      }
    })
    .catch((error: unknown) => {
      console.error("24 小時預約提醒處理失敗。", {
        bookingId: booking.id,
        error: normalizeReminderError(error),
      });
    });
}
