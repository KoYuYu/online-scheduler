import type { BookingInput } from "@/lib/types";

const maxAttachmentBytes = 5 * 1024 * 1024;

export type AttachmentInput = Pick<BookingInput, "attachmentFileName" | "attachmentMimeType" | "attachmentDataBase64">;

export function sanitizeAttachment(input: Partial<AttachmentInput>): AttachmentInput {
  const fileName = input.attachmentFileName?.trim().split(/[/\\]/).pop() || null;
  const mimeType = input.attachmentMimeType?.trim() || "application/octet-stream";
  const rawBase64 = input.attachmentDataBase64?.trim() || null;

  if (!fileName && !input.attachmentMimeType?.trim() && !rawBase64) {
    return {
      attachmentFileName: null,
      attachmentMimeType: null,
      attachmentDataBase64: null,
    };
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
    attachmentFileName: fileName,
    attachmentMimeType: mimeType,
    attachmentDataBase64: decoded.toString("base64"),
  };
}

export function attachmentErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const messages: Record<string, string> = {
    ATTACHMENT_INCOMPLETE: "附件資料不完整，請重新上傳。",
    ATTACHMENT_INVALID: "附件格式不正確，請重新上傳。",
    ATTACHMENT_SIZE: "附件不可超過 5MB。",
  };

  return messages[error.message] || null;
}
