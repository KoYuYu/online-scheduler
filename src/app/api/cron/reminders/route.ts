import { NextResponse } from "next/server";
import { processPendingNotificationJobs } from "@/lib/notification-jobs";
import { sendDueBookingReminders } from "@/lib/reminders";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

function getRequestToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
}

function authorizeCronRequest(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 500, error: "CRON_SECRET is not configured." };
  }
  if (getRequestToken(request) !== secret) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  return { ok: true };
}

async function handleReminderCron(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const notificationJobs = await processPendingNotificationJobs(20);
  const reminders = await sendDueBookingReminders(getStore());

  if (notificationJobs.failed.length || reminders.failed.length) {
    console.error("通知或預約提醒有寄送失敗。", {
      notificationJobs: notificationJobs.failed,
      reminders: reminders.failed,
    });
  }

  return NextResponse.json(
    { notificationJobs, reminders },
    { status: notificationJobs.failed.length || reminders.failed.length ? 500 : 200 }
  );
}

export async function GET(request: Request) {
  return handleReminderCron(request);
}

export async function POST(request: Request) {
  return handleReminderCron(request);
}
