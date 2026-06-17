import { describe, expect, it } from "vitest";
import { sanitizePdfAttachment } from "@/lib/attachments";

describe("sanitizePdfAttachment", () => {
  it("accepts a small PDF attachment payload", () => {
    const pdfBase64 = Buffer.from("%PDF-1.4\n").toString("base64");

    expect(
      sanitizePdfAttachment({
        attachmentFileName: "resume.pdf",
        attachmentMimeType: "application/pdf",
        attachmentDataBase64: pdfBase64,
      })
    ).toEqual({
      attachmentFileName: "resume.pdf",
      attachmentMimeType: "application/pdf",
      attachmentDataBase64: pdfBase64,
    });
  });

  it("rejects non-PDF attachments", () => {
    expect(() =>
      sanitizePdfAttachment({
        attachmentFileName: "resume.txt",
        attachmentMimeType: "text/plain",
        attachmentDataBase64: Buffer.from("hello").toString("base64"),
      })
    ).toThrow("PDF_ATTACHMENT_TYPE");
  });
});
