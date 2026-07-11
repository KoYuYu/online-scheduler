import type { BookingPageCursor } from "@/lib/types";

export function encodeBookingCursor(cursor: BookingPageCursor | null): string | null {
  if (!cursor) {
    return null;
  }
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeBookingCursor(value: string | null): BookingPageCursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<BookingPageCursor>;
    if (!parsed.startAtUtc || !parsed.id || Number.isNaN(new Date(parsed.startAtUtc).getTime())) {
      return null;
    }
    return { startAtUtc: parsed.startAtUtc, id: parsed.id };
  } catch {
    return null;
  }
}
