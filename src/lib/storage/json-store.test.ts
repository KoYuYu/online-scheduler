import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { JsonStore } from "@/lib/storage/json-store";
import type { BookingInput } from "@/lib/types";

const dataPath = path.join(os.tmpdir(), `online-scheduler-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
process.env.LOCAL_DATA_PATH = dataPath;

function input(startAtUtc: string, endAtUtc: string): BookingInput {
  return {
    source: "manual",
    title: "Batch interview",
    startAtUtc,
    endAtUtc,
    bookerName: "Jason",
    attachments: [{ fileName: "brief.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
  };
}

describe("JsonStore booking reliability", () => {
  const store = new JsonStore();

  afterAll(async () => {
    await fs.rm(dataPath, { force: true });
  });

  it("creates a batch and its notification jobs in one write", async () => {
    const bookings = await store.createBookings(
      [
        input("2030-01-02T01:00:00.000Z", "2030-01-02T02:00:00.000Z"),
        input("2030-01-03T01:00:00.000Z", "2030-01-03T02:00:00.000Z"),
      ],
      { notificationChannels: ["email", "push"], notificationBatchKey: "batch-1" }
    );
    expect(bookings).toHaveLength(2);

    const jobs = await store.claimNotificationJobs(10, new Date("2030-01-01T00:00:00.000Z"));
    expect(jobs).toHaveLength(2);
    expect(jobs.every((job) => job.bookingIds.length === 2)).toBe(true);
  });

  it("returns attachment metadata in pages and data only on demand", async () => {
    const page = await store.listBookingPage({
      scope: "upcoming",
      now: "2029-01-01T00:00:00.000Z",
      limit: 1,
    });
    expect(page.total).toBe(2);
    expect(page.bookings).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    expect(page.bookings[0].attachments[0].dataBase64).toBeUndefined();

    const attachment = await store.getBookingAttachment(page.bookings[0].id, page.bookings[0].attachments[0].id);
    expect(attachment?.dataBase64).toBe("aGVsbG8=");
  });

  it("rejects overlapping inputs without partially writing the batch", async () => {
    await expect(
      store.createBookings([
        input("2030-01-04T01:00:00.000Z", "2030-01-04T02:00:00.000Z"),
        input("2030-01-04T01:30:00.000Z", "2030-01-04T02:30:00.000Z"),
      ])
    ).rejects.toThrow("BOOKING_INPUT_OVERLAP");
    const bookings = await store.listBookings();
    expect(bookings).toHaveLength(2);
  });
});
