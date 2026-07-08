import type { NotificationLogInput } from "@/lib/types";

export type NotificationLogStore = {
  createNotificationLog(input: NotificationLogInput): Promise<unknown>;
};

export async function recordNotificationLog(store: NotificationLogStore, input: NotificationLogInput): Promise<void> {
  try {
    await store.createNotificationLog({
      ...input,
      detail: input.detail?.slice(0, 1000) || null,
    });
  } catch (error) {
    console.error("通知紀錄寫入失敗。", {
      bookingId: input.bookingId,
      kind: input.kind,
      channel: input.channel,
      status: input.status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
