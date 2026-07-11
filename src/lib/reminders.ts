import { sendBookingReminder } from "@/lib/email";
import { recordNotificationLog } from "@/lib/notification-log";
import {
  buildReminderPushPayload,
  sendAdminPushNotification,
  sendBookingBatchCreatedPush,
  type AdminPushResult,
  type PushDeliveryStore,
} from "@/lib/push";
import { getStore } from "@/lib/storage";
import type { Booking, NotificationKind } from "@/lib/types";

export type ReminderKind = "24h" | "1h";

const reminderConfigs: Record<ReminderKind, { lookaheadMs: number; label: string; sendEmail: boolean }> = {
  "24h": { lookaheadMs: 24 * 60 * 60 * 1000, label: "24 小時", sendEmail: true },
  "1h": { lookaheadMs: 60 * 60 * 1000, label: "1 小時", sendEmail: false },
};

export const reminderLookaheadMs = reminderConfigs["24h"].lookaheadMs;
export const reminder1hLookaheadMs = reminderConfigs["1h"].lookaheadMs;

type ReminderStore = PushDeliveryStore & {
  listBookings(fromUtc?: string, toUtc?: string): Promise<Booking[]>;
  createNotificationLog(input: {
    bookingId: string;
    kind: NotificationKind;
    channel: "email" | "push";
    status: "sent" | "failed" | "skipped";
    detail?: string | null;
  }): Promise<unknown>;
  markBookingReminder24hSent(id: string, sentAt: string): Promise<Booking | null>;
  markBookingReminder24hFailed(id: string, error: string): Promise<Booking | null>;
  markBookingReminder1hSent(id: string, sentAt: string): Promise<Booking | null>;
  markBookingReminder1hFailed(id: string, error: string): Promise<Booking | null>;
};

export type ReminderFailure = {
  id: string;
  title: string;
  kind: ReminderKind;
  error: string;
};

export type ReminderSent = {
  id: string;
  title: string;
  kind: ReminderKind;
  startAtUtc: string;
};

function normalizeReminderError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

function getReminderNotificationKind(kind: ReminderKind): NotificationKind {
  return kind === "24h" ? "reminder_24h" : "reminder_1h";
}

async function recordReminderChannel(
  store: ReminderStore,
  booking: Booking,
  kind: ReminderKind,
  channel: "email" | "push",
  status: "sent" | "failed" | "skipped",
  detail?: string | null
): Promise<void> {
  await recordNotificationLog(store, {
    bookingId: booking.id,
    kind: getReminderNotificationKind(kind),
    channel,
    status,
    detail: detail || null,
  });
}

function getReminderSentAt(booking: Booking, kind: ReminderKind): string | null {
  return kind === "24h" ? booking.reminder24hSentAt : booking.reminder1hSentAt;
}

function getReminderLastError(booking: Booking, kind: ReminderKind): string | null {
  return kind === "24h" ? booking.reminder24hLastError : booking.reminder1hLastError;
}

async function markReminderSent(store: ReminderStore, booking: Booking, kind: ReminderKind): Promise<void> {
  const sentAt = new Date().toISOString();
  if (kind === "24h") {
    await store.markBookingReminder24hSent(booking.id, sentAt);
    return;
  }
  await store.markBookingReminder1hSent(booking.id, sentAt);
}

async function markReminderFailed(store: ReminderStore, booking: Booking, kind: ReminderKind, error: string): Promise<void> {
  if (kind === "24h") {
    await store.markBookingReminder24hFailed(booking.id, error);
    return;
  }
  await store.markBookingReminder1hFailed(booking.id, error);
}

export function isBookingReminderDue(booking: Booking, now = new Date(), kind: ReminderKind = "24h"): boolean {
  const startTime = new Date(booking.startAtUtc).getTime();
  const nowTime = now.getTime();
  const cutoffTime = nowTime + reminderConfigs[kind].lookaheadMs;
  return (
    booking.status === "confirmed" &&
    !getReminderSentAt(booking, kind) &&
    startTime > nowTime &&
    startTime <= cutoffTime
  );
}

export function getCreatedBookingCoveredReminderKinds(booking: Booking, now = new Date()): ReminderKind[] {
  return (Object.keys(reminderConfigs) as ReminderKind[]).filter((kind) => isBookingReminderDue(booking, now, kind));
}

export function getMostUrgentDueReminderKind(booking: Booking, now = new Date()): ReminderKind | null {
  if (isBookingReminderDue(booking, now, "1h")) {
    return "1h";
  }
  if (isBookingReminderDue(booking, now, "24h")) {
    return "24h";
  }
  return null;
}

async function sendReminderChannels(booking: Booking, kind: ReminderKind, store: ReminderStore): Promise<{ sent: boolean; error?: string }> {
  const config = reminderConfigs[kind];
  const errors: string[] = [];
  const emailAlreadySent = Boolean(getReminderLastError(booking, kind)?.includes("email_sent"));
  let emailSent = emailAlreadySent;
  let pushSent = false;

  if (config.sendEmail && !emailAlreadySent) {
    try {
      const emailResult = await sendBookingReminder(booking);
      if (emailResult.sent) {
        emailSent = true;
        await recordReminderChannel(store, booking, kind, "email", "sent", "email_sent");
      } else {
        const reason = emailResult.reason || "not_sent";
        await recordReminderChannel(store, booking, kind, "email", "skipped", reason);
        errors.push(`email:${reason}`);
      }
    } catch (error) {
      const message = normalizeReminderError(error);
      await recordReminderChannel(store, booking, kind, "email", "failed", message);
      errors.push(`email:${message}`);
    }
  }

  try {
    const pushResult = await sendAdminPushNotification(buildReminderPushPayload(booking, kind), store);
    if (pushResult.sent > 0) {
      pushSent = true;
      await recordReminderChannel(
        store,
        booking,
        kind,
        "push",
        "sent",
        `sent=${pushResult.sent}; failed=${pushResult.failed}; removed=${pushResult.removed}`
      );
    } else if (pushResult.skippedReason) {
      await recordReminderChannel(store, booking, kind, "push", "skipped", pushResult.skippedReason);
      errors.push(`push:${pushResult.skippedReason}`);
    } else if (pushResult.failed > 0) {
      await recordReminderChannel(store, booking, kind, "push", "failed", `${pushResult.failed}_failed`);
      errors.push(`push:${pushResult.failed}_failed`);
    }
  } catch (error) {
    const message = normalizeReminderError(error);
    await recordReminderChannel(store, booking, kind, "push", "failed", message);
    errors.push(`push:${message}`);
  }

  if (!pushSent) {
    const preserved = emailSent ? ["email_sent"] : [];
    return { sent: false, error: preserved.concat(errors).join("; ") || "push_not_sent" };
  }

  if (errors.length) {
    console.warn(`${config.label}預約提醒部分通道未送出。`, {
      bookingId: booking.id,
      errors,
    });
  }

  return { sent: true };
}

export async function sendReminderForBooking(
  store: ReminderStore,
  booking: Booking,
  now = new Date(),
  kind: ReminderKind = "24h"
): Promise<{ sent?: ReminderSent; failed?: ReminderFailure; skipped?: true }> {
  if (!isBookingReminderDue(booking, now, kind)) {
    return { skipped: true };
  }

  try {
    const result = await sendReminderChannels(booking, kind, store);
    if (!result.sent) {
      const error = result.error || "notification_not_sent";
      await markReminderFailed(store, booking, kind, error);
      return { failed: { id: booking.id, title: booking.title, kind, error } };
    }
    await markReminderSent(store, booking, kind);
    if (kind === "1h" && isBookingReminderDue(booking, now, "24h")) {
      await markReminderSent(store, booking, "24h");
    }
    return { sent: { id: booking.id, title: booking.title, kind, startAtUtc: booking.startAtUtc } };
  } catch (error) {
    const message = normalizeReminderError(error);
    await markReminderFailed(store, booking, kind, message);
    return { failed: { id: booking.id, title: booking.title, kind, error: message } };
  }
}

export async function sendDueBookingReminders(store: ReminderStore, now = new Date()) {
  const cutoff = new Date(now.getTime() + reminderLookaheadMs);
  const bookings = await store.listBookings(now.toISOString(), cutoff.toISOString());
  const dueReminders = bookings
    .map((booking) => {
      const kind = getMostUrgentDueReminderKind(booking, now);
      return kind ? { booking, kind } : null;
    })
    .filter((reminder): reminder is { booking: Booking; kind: ReminderKind } => Boolean(reminder));
  const sent: ReminderSent[] = [];
  const failed: ReminderFailure[] = [];

  for (const reminder of dueReminders) {
    const result = await sendReminderForBooking(store, reminder.booking, now, reminder.kind);
    if (result.sent) {
      sent.push(result.sent);
    }
    if (result.failed) {
      failed.push(result.failed);
    }
  }

  return {
    checked: bookings.length,
    due: dueReminders.length,
    sent,
    failed,
    window: {
      fromUtc: now.toISOString(),
      toUtc: cutoff.toISOString(),
    },
  };
}

export function queueBookingReminderIfDue(booking: Booking): void {
  const now = new Date();
  const kind = getMostUrgentDueReminderKind(booking, now);
  if (!kind) {
    return;
  }

  const store = getStore();
  void sendReminderForBooking(store, booking, now, kind)
    .then((result) => {
      if (result.sent) {
        console.log(`${reminderConfigs[kind].label}預約提醒已送出。`, { bookingId: booking.id });
      }
      if (result.failed) {
        console.error(`${reminderConfigs[kind].label}預約提醒寄送失敗。`, result.failed);
      }
    })
    .catch((error: unknown) => {
      console.error(`${reminderConfigs[kind].label}預約提醒處理失敗。`, {
        bookingId: booking.id,
        error: normalizeReminderError(error),
      });
    });
}

export async function deliverBookingCreatedPushAndMarkCoveredReminders(
  bookings: Booking[],
  now = new Date(),
  store: ReminderStore = getStore()
): Promise<AdminPushResult> {
  const result = await sendBookingBatchCreatedPush(bookings, now, store);
  for (const booking of bookings) {
    await recordNotificationLog(store, {
      bookingId: booking.id,
      kind: "booking_created",
      channel: "push",
      status: result.sent > 0 ? "sent" : result.skippedReason ? "skipped" : "failed",
      detail: result.skippedReason || `sent=${result.sent}; failed=${result.failed}; removed=${result.removed}`,
    });
    if (result.sent > 0) {
      for (const kind of getCreatedBookingCoveredReminderKinds(booking, now)) {
        await markReminderSent(store, booking, kind);
        await recordReminderChannel(store, booking, kind, "push", "skipped", "covered_by_booking_created_push");
      }
    }
  }
  return result;
}
