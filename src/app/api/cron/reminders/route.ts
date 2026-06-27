import { NextResponse } from "next/server";
import { sendBookingReminder } from "@/lib/email";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

const reminderLookaheadMs = 24 * 60 * 60 * 1000;

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

  const now = new Date();
  const cutoff = new Date(now.getTime() + reminderLookaheadMs);
  const nowTime = now.getTime();
  const cutoffTime = cutoff.getTime();
  const store = getStore();
  const bookings = await store.listBookings(now.toISOString(), cutoff.toISOString());
  const dueBookings = bookings.filter((booking) => {
    const startTime = new Date(booking.startAtUtc).getTime();
    return (
      booking.status === "confirmed" &&
      !booking.reminder24hSentAt &&
      startTime > nowTime &&
      startTime <= cutoffTime
    );
  });

  const sent: Array<{ id: string; title: string; startAtUtc: string }> = [];
  const failed: Array<{ id: string; title: string; error: string }> = [];

  for (const booking of dueBookings) {
    try {
      const result = await sendBookingReminder(booking);
      if (!result.sent) {
        failed.push({ id: booking.id, title: booking.title, error: result.reason || "email_not_sent" });
        continue;
      }
      await store.markBookingReminder24hSent(booking.id, new Date().toISOString());
      sent.push({ id: booking.id, title: booking.title, startAtUtc: booking.startAtUtc });
    } catch (error) {
      failed.push({
        id: booking.id,
        title: booking.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (failed.length) {
    console.error("24 小時預約提醒有寄送失敗。", { failed });
  }

  return NextResponse.json(
    {
      checked: bookings.length,
      due: dueBookings.length,
      sent,
      failed,
      window: {
        fromUtc: now.toISOString(),
        toUtc: cutoff.toISOString(),
      },
    },
    { status: failed.length ? 500 : 200 }
  );
}

export async function GET(request: Request) {
  return handleReminderCron(request);
}

export async function POST(request: Request) {
  return handleReminderCron(request);
}
