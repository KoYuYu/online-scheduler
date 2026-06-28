import {
  addDaysToYmd,
  defaultRangeYmd,
  EASTERN_TIME_ZONE,
  formatEtDateLabel,
  formatEtTimeLabel,
  formatEtWeekdayLabel,
  formatYmd,
  localYmdTimeToUtc,
  minutesOfDay,
  minutesFromTime,
  timeFromMinutes,
  ymdToWeekday,
} from "@/lib/time";
import type { AvailabilityRule, Booking, PublicSlot } from "@/lib/types";

const SLOT_START_STEP_MINUTES = 30;

type AvailabilityBuildOptions = {
  now?: Date;
  excludePast?: boolean;
};

export function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(endA).getTime() > new Date(startB).getTime();
}

export function normalizeRange(from?: string | null, to?: string | null): { fromYmd: string; toYmd: string } {
  const fallback = defaultRangeYmd();
  return {
    fromYmd: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : fallback.fromYmd,
    toYmd: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : fallback.toYmd,
  };
}

export function isPastStart(startAtUtc: string, now = new Date()): boolean {
  return new Date(startAtUtc).getTime() <= now.getTime();
}

export function buildAvailableSlots(
  rules: AvailabilityRule[],
  bookings: Booking[],
  fromYmd: string,
  toYmd: string,
  options: AvailabilityBuildOptions = {}
): PublicSlot[] {
  return buildPublicCalendarSlots(rules, bookings, fromYmd, toYmd, options).filter((slot) => slot.status !== "blocked");
}

export function buildPublicCalendarSlots(
  rules: AvailabilityRule[],
  bookings: Booking[],
  fromYmd: string,
  toYmd: string,
  options: AvailabilityBuildOptions = {}
): PublicSlot[] {
  const slots: PublicSlot[] = [];
  const activeRules = rules.filter((rule) => rule.isActive);
  const now = options.now || new Date();

  for (let ymd = fromYmd; ymd <= toYmd; ymd = addDaysToYmd(ymd, 1)) {
    const weekday = ymdToWeekday(ymd);
    const dayRules = activeRules.filter((rule) => rule.weekday === weekday);

    for (const rule of dayRules) {
      const startMinutes = minutesFromTime(rule.startTimeLocal);
      const endMinutes = minutesFromTime(rule.endTimeLocal);

      for (let cursor = startMinutes; cursor + rule.slotMinutes <= endMinutes; cursor += SLOT_START_STEP_MINUTES) {
        const startAtUtc = localYmdTimeToUtc(ymd, timeFromMinutes(cursor), rule.timezone || EASTERN_TIME_ZONE).toISOString();
        const endAtUtc = localYmdTimeToUtc(ymd, timeFromMinutes(cursor + rule.slotMinutes), rule.timezone || EASTERN_TIME_ZONE).toISOString();
        if (options.excludePast && isPastStart(startAtUtc, now)) {
          continue;
        }
        const blocked = bookings.some(
          (booking) => booking.status !== "cancelled" && overlaps(startAtUtc, endAtUtc, booking.startAtUtc, booking.endAtUtc)
        );

        slots.push({
          id: `${startAtUtc}_${endAtUtc}`,
          startAtUtc,
          endAtUtc,
          dateKey: ymd,
          dateLabel: formatEtDateLabel(startAtUtc),
          weekdayLabel: formatEtWeekdayLabel(startAtUtc),
          timeLabel: formatEtTimeLabel(startAtUtc, endAtUtc),
          status: blocked ? "blocked" : "available",
        });
      }
    }
  }

  return slots.sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
}

export function findMatchingSlot(slots: PublicSlot[], startAtUtc: string, endAtUtc: string): PublicSlot | null {
  return (
    slots.find((slot) => slot.startAtUtc === startAtUtc && slot.endAtUtc === endAtUtc) ||
    slots.find((slot) => Math.abs(new Date(slot.startAtUtc).getTime() - new Date(startAtUtc).getTime()) < 1000) ||
    null
  );
}

export function isTimeRangeAvailable(
  rules: AvailabilityRule[],
  bookings: Booking[],
  startAtUtc: string,
  endAtUtc: string,
  options: { now?: Date; rejectPast?: boolean } = {}
): boolean {
  const start = new Date(startAtUtc);
  const end = new Date(endAtUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() >= end.getTime()) {
    return false;
  }
  if (options.rejectPast && start.getTime() <= (options.now || new Date()).getTime()) {
    return false;
  }

  const blocked = bookings.some(
    (booking) => booking.status !== "cancelled" && overlaps(startAtUtc, endAtUtc, booking.startAtUtc, booking.endAtUtc)
  );
  if (blocked) {
    return false;
  }

  return rules.some((rule) => rule.isActive && isRangeInsideRule(rule, start, end));
}

function isRangeInsideRule(rule: AvailabilityRule, start: Date, end: Date): boolean {
  const timezone = rule.timezone || EASTERN_TIME_ZONE;
  const startYmd = formatYmd(start, timezone);
  const endYmd = formatYmd(end, timezone);
  const startMinutes = minutesOfDay(start, timezone);
  const endMinutes = minutesOfDay(end, timezone);
  const effectiveEndMinutes =
    endYmd === startYmd ? endMinutes : endYmd === addDaysToYmd(startYmd, 1) && endMinutes === 0 ? 24 * 60 : null;

  if (effectiveEndMinutes === null || ymdToWeekday(startYmd) !== rule.weekday) {
    return false;
  }

  return startMinutes >= minutesFromTime(rule.startTimeLocal) && effectiveEndMinutes <= minutesFromTime(rule.endTimeLocal);
}

export function serializePublicSlots(slots: PublicSlot[]): PublicSlot[] {
  return slots.map((slot) => ({
    id: slot.id,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    dateKey: slot.dateKey,
    dateLabel: slot.dateLabel,
    weekdayLabel: slot.weekdayLabel,
    timeLabel: slot.timeLabel,
    status: slot.status || "available",
  }));
}
