import type { BookingInput } from "@/lib/types";

const maxPdfBytes = 5 * 1024 * 1024;

export type PdfAttachmentInput = Pick<BookingInput, "attachmentFileName" | "attachmentMimeType" | "attachmentDataBase64">;

export function sanitizePdfAttachment(input: Partial<PdfAttachmentInput>): PdfAttachmentInput {
  const fileName = input.attachmentFileName?.trim() || null;
  const mimeType = input.attachmentMimeType?.trim() || null;
  const rawBase64 = input.attachmentDataBase64?.trim() || null;

  if (!fileName && !mimeType && !rawBase64) {
    return {
      attachmentFileName: null,
      attachmentMimeType: null,
      attachmentDataBase64: null,
    };
  }

  if (!fileName || !mimeType || !rawBase64) {
    throw new Error("PDF_ATTACHMENT_INCOMPLETE");
  }

  if (mimeType !== "application/pdf" || !fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF_ATTACHMENT_TYPE");
  }

  const base64 = rawBase64.includes(",") ? rawBase64.split(",").pop() || "" : rawBase64;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("PDF_ATTACHMENT_INVALID");
  }

  const decoded = Buffer.from(base64, "base64");
  if (!decoded.length || decoded.byteLength > maxPdfBytes) {
    throw new Error("PDF_ATTACHMENT_SIZE");
  }

  return {
    attachmentFileName: fileName,
    attachmentMimeType: "application/pdf",
    attachmentDataBase64: decoded.toString("base64"),
  };
}

export function pdfAttachmentErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const messages: Record<string, string> = {
    PDF_ATTACHMENT_INCOMPLETE: "PDF 附件資料不完整，請重新上傳。",
    PDF_ATTACHMENT_TYPE: "附件只支援 PDF 檔案。",
    PDF_ATTACHMENT_INVALID: "PDF 附件格式不正確，請重新上傳。",
    PDF_ATTACHMENT_SIZE: "PDF 附件不可超過 5MB。",
  };

  return messages[error.message] || null;
}
