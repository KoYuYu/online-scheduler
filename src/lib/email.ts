import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import type { Booking } from "@/lib/types";
import { formatEtDateTimeRangeLabel } from "@/lib/time";

type NotificationResult = { sent: boolean; reason?: string };
type NotificationKind = "created" | "reminder24h";

function getSubject(booking: Booking, kind: NotificationKind): string {
  return kind === "reminder24h" ? `24 小時預約提醒：${booking.title}` : `新預約：${booking.title}`;
}

function getBookingNotificationText(booking: Booking, kind: NotificationKind): string {
  const lines = [
    `主題：${booking.title}`,
    `時間：${formatEtDateTimeRangeLabel(booking.startAtUtc, booking.endAtUtc)}`,
    `預約者：${booking.bookerName || "未提供"}`,
    `邀請人：${booking.invitedByName || ""}`,
    `Zoom: ${booking.zoomJoinUrl || ""}`,
    `會議號：${booking.meetingId || ""}`,
    `密碼：${booking.passcode || ""}`,
    `附件：${booking.attachments.length ? booking.attachments.map((attachment) => attachment.fileName).join(", ") : "無"}`,
    `備註：${booking.notes || ""}`,
  ];

  if (kind === "reminder24h") {
    return ["提醒：此預約將在 24 小時內開始。", "", ...lines].join("\n");
  }

  return lines.join("\n");
}

function getAttachments(booking: Booking) {
  return booking.attachments.map((attachment) => ({
    filename: attachment.fileName,
    content: attachment.dataBase64,
    contentType: attachment.mimeType || "application/octet-stream",
  }));
}

async function sendWithResend(booking: Booking, apiKey: string, to: string, kind: NotificationKind): Promise<NotificationResult> {
  const attachments = getAttachments(booking);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Online Scheduler <onboarding@resend.dev>",
      to: [to],
      subject: getSubject(booking, kind),
      text: getBookingNotificationText(booking, kind),
      attachments: attachments.length
        ? attachments.map((attachment) => ({ filename: attachment.filename, content: attachment.content }))
        : undefined,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Resend API ${response.status}: ${detail}`);
  }

  return { sent: true };
}

async function resolveSmtpConnectionHost(host: string): Promise<string> {
  if (process.env.SMTP_FORCE_IPV4 === "false" || isIP(host)) {
    return host;
  }

  try {
    const [ipv4Address] = await resolve4(host);
    if (ipv4Address) {
      return ipv4Address;
    }
  } catch (error) {
    console.warn("SMTP IPv4 解析失敗，將使用原始主機名稱。", {
      host,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return host;
}

async function sendBookingEmail(booking: Booking, kind: NotificationKind): Promise<NotificationResult> {
  const to = process.env.NOTIFY_TO_EMAIL || "jasonko12033@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    return sendWithResend(booking, resendApiKey, to, kind);
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log("略過預約通知：尚未設定 SMTP 環境變數。", {
      to,
      bookingId: booking.id,
    });
    return { sent: false, reason: "smtp_not_configured" };
  }

  const connectionHost = await resolveSmtpConnectionHost(host);
  const transporter = nodemailer.createTransport({
    host: connectionHost,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
    tls: connectionHost === host ? undefined : { servername: host },
  });

  const attachments = getAttachments(booking);
  await transporter.sendMail({
    to,
    from: process.env.SMTP_FROM_EMAIL || user,
    subject: getSubject(booking, kind),
    attachments: attachments.length
      ? attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          contentType: attachment.contentType,
      }))
      : undefined,
    text: getBookingNotificationText(booking, kind),
  });

  return { sent: true };
}

export async function sendBookingNotification(booking: Booking): Promise<NotificationResult> {
  return sendBookingEmail(booking, "created");
}

export async function sendBookingReminder(booking: Booking): Promise<NotificationResult> {
  return sendBookingEmail(booking, "reminder24h");
}

export function queueBookingNotification(booking: Booking): void {
  void sendBookingNotification(booking)
    .then((result) => {
      if (result.sent) {
        console.log("預約通知信已送出。", { bookingId: booking.id });
        return;
      }

      console.warn("預約通知信未寄送。", {
        bookingId: booking.id,
        reason: result.reason || "unknown",
      });
    })
    .catch((error: unknown) => {
      console.error("預約已建立，但通知信寄送失敗。", {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
