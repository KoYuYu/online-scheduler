import { sendBookingBatchNotification } from "@/lib/email";
import { recordNotificationLog } from "@/lib/notification-log";
import { deliverBookingCreatedPushAndMarkCoveredReminders } from "@/lib/reminders";
import { getStore } from "@/lib/storage";
import type { Booking, NotificationJob } from "@/lib/types";

const maxAttempts = 8;
const retryMinutes = [1, 5, 15, 30, 60, 180, 360, 720];

export type NotificationJobRunResult = {
  claimed: number;
  sent: number;
  failed: Array<{ id: string; kind: NotificationJob["kind"]; error: string; terminal: boolean }>;
};

function normalizeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function getNotificationRetryDelayMinutes(attempts: number): number {
  return retryMinutes[Math.min(Math.max(attempts - 1, 0), retryMinutes.length - 1)];
}

function nextAttemptAt(job: NotificationJob, now: Date): string {
  const delayMinutes = getNotificationRetryDelayMinutes(job.attempts);
  return new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();
}

async function deliverEmailJob(job: NotificationJob, bookings: Booking[]): Promise<void> {
  const store = getStore();
  try {
    const result = await sendBookingBatchNotification(bookings);
    if (!result.sent) {
      throw new Error(result.reason || "email_not_sent");
    }
    for (const booking of bookings) {
      await recordNotificationLog(store, {
        bookingId: booking.id,
        kind: "booking_created",
        channel: "email",
        status: "sent",
        detail: bookings.length > 1 ? `batch_email_sent:${bookings.length}` : "email_sent",
      });
    }
  } catch (error) {
    const message = normalizeError(error);
    for (const booking of bookings) {
      await recordNotificationLog(store, {
        bookingId: booking.id,
        kind: "booking_created",
        channel: "email",
        status: "failed",
        detail: message,
      });
    }
    throw error;
  }
}

async function deliverPushJob(bookings: Booking[]): Promise<void> {
  const result = await deliverBookingCreatedPushAndMarkCoveredReminders(bookings);
  if (result.sent <= 0) {
    throw new Error(result.skippedReason || `push_failed:${result.failed}`);
  }
}

export async function processPendingNotificationJobs(limit = 10, now = new Date()): Promise<NotificationJobRunResult> {
  const store = getStore();
  const jobs = await store.claimNotificationJobs(limit, now);
  const result: NotificationJobRunResult = { claimed: jobs.length, sent: 0, failed: [] };

  for (const job of jobs) {
    try {
      const bookings = await store.getBookingsByIds(job.bookingIds, job.kind === "booking_created_email");
      if (!bookings.length) {
        await store.markNotificationJobSent(job.id);
        result.sent += 1;
        continue;
      }
      if (job.kind === "booking_created_email") {
        await deliverEmailJob(job, bookings);
      } else {
        await deliverPushJob(bookings);
      }
      await store.markNotificationJobSent(job.id);
      result.sent += 1;
    } catch (error) {
      const message = normalizeError(error);
      const terminal = job.attempts >= maxAttempts;
      await store.markNotificationJobFailed(job.id, message, nextAttemptAt(job, now), terminal);
      result.failed.push({ id: job.id, kind: job.kind, error: message, terminal });
    }
  }

  return result;
}

export function queueNotificationJobProcessing(): void {
  void processPendingNotificationJobs().catch((error: unknown) => {
    console.error("通知工作處理失敗，將由 cron 重試。", { error: normalizeError(error) });
  });
}
