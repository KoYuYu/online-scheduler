import { NextResponse } from "next/server";
import { buildPublicCalendarSlots, normalizeRange, serializePublicSlots } from "@/lib/availability";
import { getStore } from "@/lib/storage";
import { addDaysToYmd, localYmdTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { fromYmd, toYmd } = normalizeRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const store = getStore();
  await store.ensureDefaultAvailability();
  const rules = await store.listAvailabilityRules();
  const fromUtc = localYmdTimeToUtc(fromYmd, "00:00", "America/New_York").toISOString();
  const toUtc = localYmdTimeToUtc(addDaysToYmd(toYmd, 1), "00:00", "America/New_York").toISOString();
  const bookings = await store.listBookings(fromUtc, toUtc);
  const slots = buildPublicCalendarSlots(rules, bookings, fromYmd, toYmd, { excludePast: true });
  return NextResponse.json({ slots: serializePublicSlots(slots) });
}
