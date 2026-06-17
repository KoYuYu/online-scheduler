import nodemailer from "nodemailer";
import type { Booking } from "@/lib/types";
import { formatEtTimeLabel } from "@/lib/time";

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

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
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
