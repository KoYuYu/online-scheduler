import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { getStore } from "@/lib/storage";
import { formatEtDateTimeRangeLabel } from "@/lib/time";
import type { Booking, PushSubscriptionRecord } from "@/lib/types";

export type AdminPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  bookingId?: string;
  kind?: "booking_created" | "reminder_24h" | "reminder_1h" | "test";
};

export type AdminPushResult = {
  sent: number;
  failed: number;
  removed: number;
  skippedReason?: string;
};

export type PushDeliveryStore = {
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean>;
  markPushSubscriptionError(id: string, error: string): Promise<void>;
};

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:jasonko12033@gmail.com";
  if (!publicKey || !privateKey) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey(): string {
  return process.env.WEB_PUSH_PUBLIC_KEY?.trim() || "";
}

function normalizePushError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }
  return String(error).slice(0, 1000);
}

function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}

function toWebPushSubscription(subscription: PushSubscriptionRecord): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export function buildBookingCreatedPushPayload(booking: Booking, now = new Date()): AdminPushPayload {
  const leadMs = new Date(booking.startAtUtc).getTime() - now.getTime();
  const oneHourMs = 60 * 60 * 1000;
  const twentyFourHoursMs = 24 * oneHourMs;
  const prefix =
    leadMs > 0 && leadMs <= oneHourMs
      ? "新預約，即將開始"
      : leadMs > oneHourMs && leadMs <= twentyFourHoursMs
        ? "新預約，24 小時內開始"
        : "新預約";

  return {
    title: `${prefix}：${booking.title}`,
    body: formatEtDateTimeRangeLabel(booking.startAtUtc, booking.endAtUtc),
    url: "/admin",
    tag: `booking-created-${booking.id}`,
    bookingId: booking.id,
    kind: "booking_created",
  };
}

export async function sendAdminPushNotification(
  payload: AdminPushPayload,
  store: PushDeliveryStore = getStore()
): Promise<AdminPushResult> {
  const config = getVapidConfig();
  if (!config) {
    return { sent: 0, failed: 0, removed: 0, skippedReason: "web_push_not_configured" };
  }

  const subscriptions = await store.listPushSubscriptions();
  if (!subscriptions.length) {
    return { sent: 0, failed: 0, removed: 0, skippedReason: "no_push_subscriptions" };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const body = JSON.stringify({
    icon: "/icons/app-icon-fashion-192.png",
    badge: "/icons/app-icon-fashion-192.png",
    url: "/admin",
    ...payload,
  });
  const result: AdminPushResult = { sent: 0, failed: 0, removed: 0 };

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(toWebPushSubscription(subscription), body, {
        TTL: 60 * 60 * 24,
      });
      result.sent += 1;
    } catch (error) {
      if (isExpiredSubscriptionError(error)) {
        await store.deletePushSubscriptionByEndpoint(subscription.endpoint);
        result.removed += 1;
        continue;
      }
      result.failed += 1;
      await store.markPushSubscriptionError(subscription.id, normalizePushError(error));
    }
  }

  return result;
}

export async function sendBookingCreatedPush(
  booking: Booking,
  now = new Date(),
  store: PushDeliveryStore = getStore()
): Promise<AdminPushResult> {
  return sendAdminPushNotification(buildBookingCreatedPushPayload(booking, now), store);
}

export function queueAdminPushNotification(payload: AdminPushPayload, logLabel = "管理員推送"): void {
  void sendAdminPushNotification(payload)
    .then((result) => {
      if (result.sent > 0) {
        console.log(`${logLabel}已送出。`, result);
        return;
      }
      console.warn(`${logLabel}未送出。`, result);
    })
    .catch((error: unknown) => {
      console.error(`${logLabel}處理失敗。`, {
        error: normalizePushError(error),
      });
    });
}

export function queueBookingCreatedPush(booking: Booking): void {
  void sendBookingCreatedPush(booking)
    .then((result) => {
      if (result.sent > 0) {
        console.log("新預約推送已送出。", result);
        return;
      }
      console.warn("新預約推送未送出。", result);
    })
    .catch((error: unknown) => {
      console.error("新預約推送處理失敗。", {
        error: normalizePushError(error),
      });
    });
}

export function buildReminderPushPayload(booking: Booking, kind: "24h" | "1h"): AdminPushPayload {
  return {
    title: `${kind === "24h" ? "24 小時" : "1 小時"}預約提醒：${booking.title}`,
    body: formatEtDateTimeRangeLabel(booking.startAtUtc, booking.endAtUtc),
    url: "/admin",
    tag: `booking-reminder-${kind}-${booking.id}`,
    bookingId: booking.id,
    kind: kind === "24h" ? "reminder_24h" : "reminder_1h",
  };
}
