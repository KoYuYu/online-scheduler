import { describe, expect, it } from "vitest";
import { sanitizeAttachment, sanitizeAttachments } from "@/lib/attachments";

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

  it("rejects more than five attachment entries", () => {
    const fileBase64 = Buffer.from("hello").toString("base64");

    expect(() =>
      sanitizeAttachments({
        attachments: Array.from({ length: 6 }, (_, index) => ({
          fileName: `notes-${index}.txt`,
          mimeType: "text/plain",
          dataBase64: fileBase64,
        })),
      })
    ).toThrow("ATTACHMENT_COUNT");
  });

  it("rejects attachment batches larger than the total byte limit", () => {
    const fourMegabytes = Buffer.alloc(4 * 1024 * 1024, 1).toString("base64");

    expect(() =>
      sanitizeAttachments({
        attachments: [
          { fileName: "one.bin", mimeType: "application/octet-stream", dataBase64: fourMegabytes },
          { fileName: "two.bin", mimeType: "application/octet-stream", dataBase64: fourMegabytes },
          { fileName: "three.bin", mimeType: "application/octet-stream", dataBase64: fourMegabytes },
        ],
      })
    ).toThrow("ATTACHMENT_TOTAL_SIZE");
  });
});
