export const EASTERN_TIME_ZONE = "America/New_York";
export const DEFAULT_SLOT_MINUTES = 60;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function getZonedParts(date: Date, timeZone: string): DateTimeParts & { second: number } {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function zonedTimeToUtc(parts: DateTimeParts, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  const zonedParts = getZonedParts(utcGuess, timeZone);
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second
  );
  const offset = zonedAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatYmd(date: Date, timeZone = EASTERN_TIME_ZONE): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function minutesOfDay(date: Date, timeZone = EASTERN_TIME_ZONE): number {
  const parts = getZonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function ymdToWeekday(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time: ${value}`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function minutesFromTime(value: string): number {
  const parsed = parseTimeOfDay(value);
  return parsed.hour * 60 + parsed.minute;
}

export function timeFromMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function localYmdTimeToUtc(ymd: string, time: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  const { hour, minute } = parseTimeOfDay(time);
  return zonedTimeToUtc({ year, month, day, hour, minute }, timeZone);
}

export function formatEtDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatEtWeekdayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
  }).format(new Date(iso));
}

export function formatEtTimeLabel(startIso: string, endIso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startIso))} - ${formatter.format(new Date(endIso))} ET`;
}

export function formatEtDateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function defaultRangeYmd(): { fromYmd: string; toYmd: string } {
  const fromYmd = formatYmd(new Date(), EASTERN_TIME_ZONE);
  return { fromYmd, toYmd: addDaysToYmd(fromYmd, 14) };
}
