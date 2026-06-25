import { describe, expect, it } from "vitest";
import { sanitizeAttachment } from "@/lib/attachments";

describe("sanitizeAttachment", () => {
  it("accepts a small attachment payload", () => {
    const fileBase64 = Buffer.from("hello").toString("base64");

    expect(
      sanitizeAttachment({
        attachmentFileName: "notes.txt",
        attachmentMimeType: "text/plain",
        attachmentDataBase64: fileBase64,
      })
    ).toEqual({
      attachmentFileName: "notes.txt",
      attachmentMimeType: "text/plain",
      attachmentDataBase64: fileBase64,
    });
  });

  it("defaults unknown MIME type to application/octet-stream", () => {
    const fileBase64 = Buffer.from("hello").toString("base64");

    expect(
      sanitizeAttachment({
        attachmentFileName: "notes",
        attachmentMimeType: "",
        attachmentDataBase64: fileBase64,
      })
    ).toEqual({
      attachmentFileName: "notes",
      attachmentMimeType: "application/octet-stream",
      attachmentDataBase64: fileBase64,
    });
  });

  it("rejects incomplete attachments", () => {
    expect(() =>
      sanitizeAttachment({
        attachmentFileName: "resume.txt",
        attachmentMimeType: "text/plain",
      })
    ).toThrow("ATTACHMENT_INCOMPLETE");
  });
});
