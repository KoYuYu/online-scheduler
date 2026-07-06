import type { BookingAttachmentInput, BookingInput } from "@/lib/types";

const maxAttachmentBytes = 5 * 1024 * 1024;
const maxAttachmentCount = 5;
const maxTotalAttachmentBytes = 10 * 1024 * 1024;

export type AttachmentInput = Pick<BookingInput, "attachmentFileName" | "attachmentMimeType" | "attachmentDataBase64">;
export type SanitizedAttachment = Required<BookingAttachmentInput>;
type SanitizedAttachmentPayload = SanitizedAttachment & { byteLength: number };

function stripAttachmentSize(attachment: SanitizedAttachmentPayload): SanitizedAttachment {
  const { byteLength: _byteLength, ...sanitizedAttachment } = attachment;
  return sanitizedAttachment;
}

function sanitizeAttachmentPayload(input: Partial<BookingAttachmentInput>): SanitizedAttachmentPayload | null {
  const fileName = input.fileName?.trim().split(/[/\\]/).pop() || null;
  const mimeType = input.mimeType?.trim() || "application/octet-stream";
  const rawBase64 = input.dataBase64?.trim() || null;

  if (!fileName && !input.mimeType?.trim() && !rawBase64) {
    return null;
  }

  if (!fileName || !rawBase64) {
    throw new Error("ATTACHMENT_INCOMPLETE");
  }

  const base64 = rawBase64.includes(",") ? rawBase64.split(",").pop() || "" : rawBase64;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("ATTACHMENT_INVALID");
  }

  const decoded = Buffer.from(base64, "base64");
  if (!decoded.length || decoded.byteLength > maxAttachmentBytes) {
    throw new Error("ATTACHMENT_SIZE");
  }

  return {
    fileName,
    mimeType,
    dataBase64: decoded.toString("base64"),
    byteLength: decoded.byteLength,
  };
}

export function sanitizeAttachment(input: Partial<AttachmentInput>): AttachmentInput {
  const attachment = sanitizeAttachmentPayload({
    fileName: input.attachmentFileName,
    mimeType: input.attachmentMimeType,
    dataBase64: input.attachmentDataBase64,
  });

  if (!attachment) {
    return {
      attachmentFileName: null,
      attachmentMimeType: null,
      attachmentDataBase64: null,
    };
  }

  return {
    attachmentFileName: attachment.fileName,
    attachmentMimeType: attachment.mimeType,
    attachmentDataBase64: attachment.dataBase64,
  };
}

export function sanitizeAttachments(input: { attachments?: BookingAttachmentInput[] } & Partial<AttachmentInput>): SanitizedAttachment[] {
  const rawAttachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (rawAttachments.length > maxAttachmentCount) {
    throw new Error("ATTACHMENT_COUNT");
  }

  const attachments = rawAttachments
    .map((attachment) => sanitizeAttachmentPayload(attachment))
    .filter((attachment): attachment is SanitizedAttachmentPayload => Boolean(attachment));
  const totalBytes = attachments.reduce((sum, attachment) => sum + attachment.byteLength, 0);
  if (totalBytes > maxTotalAttachmentBytes) {
    throw new Error("ATTACHMENT_TOTAL_SIZE");
  }

  if (attachments.length) {
    return attachments.map(stripAttachmentSize);
  }

  const legacyAttachment = sanitizeAttachmentPayload({
    fileName: input.attachmentFileName,
    mimeType: input.attachmentMimeType,
    dataBase64: input.attachmentDataBase64,
  });
  return legacyAttachment ? [stripAttachmentSize(legacyAttachment)] : [];
}

export function attachmentErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const messages: Record<string, string> = {
    ATTACHMENT_INCOMPLETE: "附件資料不完整，請重新上傳。",
    ATTACHMENT_INVALID: "附件格式不正確，請重新上傳。",
    ATTACHMENT_SIZE: "附件不可超過 5MB。",
    ATTACHMENT_COUNT: "附件最多只能上傳 5 個。",
    ATTACHMENT_TOTAL_SIZE: "附件總大小不可超過 10MB。",
  };

  return messages[error.message] || null;
}
