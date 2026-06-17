import { NextResponse } from "next/server";
import { buildAvailableSlots, isTimeRangeAvailable, normalizeRange, serializePublicSlots } from "@/lib/availability";
import { getStore } from "@/lib/storage";
import { addDaysToYmd, formatYmd, localYmdTimeToUtc } from "@/lib/time";
import { parseZoomInvite } from "@/lib/zoom-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const preview = parseZoomInvite(body.text || "");
    const parsedYmd = formatYmd(new Date(preview.startAtUtc));
    const { fromYmd, toYmd } = normalizeRange(parsedYmd, addDaysToYmd(parsedYmd, 7));
    const store = getStore();
    await store.ensureDefaultAvailability();
    const rules = await store.listAvailabilityRules();
    const fromUtc = localYmdTimeToUtc(fromYmd, "00:00", "America/New_York").toISOString();
    const toUtc = localYmdTimeToUtc(addDaysToYmd(toYmd, 1), "00:00", "America/New_York").toISOString();
    const bookings = await store.listBookings(fromUtc, toUtc);
    const slots = buildAvailableSlots(rules, bookings, fromYmd, toYmd);
    const available = isTimeRangeAvailable(rules, bookings, preview.startAtUtc, preview.endAtUtc);
    return NextResponse.json({ preview, available, suggestions: available ? [] : serializePublicSlots(slots.slice(0, 6)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "無法解析 Zoom 邀請。" },
      { status: 400 }
    );
  }
}
