import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import type { Booking } from "@/lib/types";
import { formatEtTimeLabel } from "@/lib/time";

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

export async function sendBookingNotification(booking: Booking): Promise<{ sent: boolean; reason?: string }> {
  const to = process.env.NOTIFY_TO_EMAIL || "jasonko12033@gmail.com";
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

  await transporter.sendMail({
    to,
    from: process.env.SMTP_FROM_EMAIL || user,
    subject: `新預約：${booking.title}`,
    attachments:
      booking.attachmentDataBase64 && booking.attachmentFileName
        ? [
            {
              filename: booking.attachmentFileName,
              content: Buffer.from(booking.attachmentDataBase64, "base64"),
              contentType: booking.attachmentMimeType || "application/pdf",
            },
          ]
        : undefined,
    text: [
      `主題：${booking.title}`,
      `時間：${formatEtTimeLabel(booking.startAtUtc, booking.endAtUtc)}`,
      `預約者：${booking.bookerName || "未提供"}`,
      `邀請人：${booking.invitedByName || ""}`,
      `Zoom: ${booking.zoomJoinUrl || ""}`,
      `會議號：${booking.meetingId || ""}`,
      `密碼：${booking.passcode || ""}`,
      `PDF附件：${booking.attachmentFileName || "無"}`,
      `備註：${booking.notes || ""}`,
    ].join("\n"),
  });

  return { sent: true };
}

export function queueBookingNotification(booking: Booking): void {
  void sendBookingNotification(booking)
    .then((result) => {
      if (result.sent) {
        console.log("預約通知信已交由 SMTP 寄送。", { bookingId: booking.id });
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
