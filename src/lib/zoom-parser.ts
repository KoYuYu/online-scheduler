import { addMinutes, DEFAULT_SLOT_MINUTES, EASTERN_TIME_ZONE, formatEtDateTimeLabel, formatEtTimeLabel, zonedTimeToUtc } from "@/lib/time";
import type { ParsedZoomInvite } from "@/lib/types";

const TIMEZONE_KEYWORDS: Array<[RegExp, string]> = [
  [/太平洋|Pacific|PST|PDT/i, "America/Los_Angeles"],
  [/東部|东部|Eastern|EST|EDT/i, EASTERN_TIME_ZONE],
  [/中部|Central|CST|CDT/i, "America/Chicago"],
  [/山地|Mountain|MST|MDT/i, "America/Denver"],
  [/台北|臺北|Taipei|台湾|台灣/i, "Asia/Taipei"],
];

function pickLine(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*[:：]\\s*(.+)`, "i"));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function parseInviter(text: string): string | null {
  const chinese = text.match(/^\s*(.+?)邀请你参加已安排的Zoom会议/i);
  if (chinese?.[1]) {
    return chinese[1].trim();
  }
  const english = text.match(/^\s*(.+?)\s+(?:is inviting|has invited) you/i);
  return english?.[1]?.trim() || null;
}

function parseTimeZone(value: string): { timeZone: string; confirmed: boolean } {
  for (const [pattern, timeZone] of TIMEZONE_KEYWORDS) {
    if (pattern.test(value)) {
      return { timeZone, confirmed: true };
    }
  }
  return { timeZone: EASTERN_TIME_ZONE, confirmed: false };
}

function parseChineseDateTime(value: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const match = value.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})[:：](\d{2})\s*(上午|下午|AM|PM)?/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[4]);
  const marker = match[6]?.toLowerCase();
  if ((marker === "下午" || marker === "pm") && hour < 12) {
    hour += 12;
  }
  if ((marker === "上午" || marker === "am") && hour === 12) {
    hour = 0;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour,
    minute: Number(match[5]),
  };
}

function parseEnglishDateTime(value: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function parseJoinUrl(text: string): string | null {
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s]+/g)).map((match) => match[0].trim());
  return urls.find((url) => /zoom\.us\/j\//i.test(url)) || urls.find((url) => /zoom\.us/i.test(url)) || null;
}

export function parseZoomInvite(rawText: string, slotMinutes = DEFAULT_SLOT_MINUTES, sourceTimeZoneOverride?: string): ParsedZoomInvite {
  const text = rawText.trim();
  if (!text) {
    throw new Error("請先貼上 Zoom 邀請內容。");
  }

  const originalTimeText = pickLine(text, ["时间", "時間", "Time"]);
  if (!originalTimeText) {
    throw new Error("找不到會議時間。");
  }

  const parsedDateTime = parseChineseDateTime(originalTimeText) || parseEnglishDateTime(originalTimeText);
  if (!parsedDateTime) {
    throw new Error("無法解析會議日期與時間。");
  }

  const detectedTimeZone = parseTimeZone(originalTimeText);
  const sourceTimeZone = sourceTimeZoneOverride || detectedTimeZone.timeZone;
  const timeZoneConfirmed = Boolean(sourceTimeZoneOverride) || detectedTimeZone.confirmed;
  const timeZoneSource = sourceTimeZoneOverride ? "user" : detectedTimeZone.confirmed ? "invite" : "missing";
  const start = zonedTimeToUtc(parsedDateTime, sourceTimeZone);
  const end = addMinutes(start, slotMinutes);
  const startAtUtc = start.toISOString();
  const endAtUtc = end.toISOString();

  return {
    invitedByName: parseInviter(text),
    title: pickLine(text, ["主题", "主題", "Topic"]) || "Zoom 會議",
    originalTimeText,
    sourceTimeZone,
    timeZoneConfirmed,
    timeZoneSource,
    startAtUtc,
    endAtUtc,
    startAtEastern: formatEtDateTimeLabel(startAtUtc),
    endAtEastern: formatEtDateTimeLabel(endAtUtc),
    easternTimeLabel: formatEtTimeLabel(startAtUtc, endAtUtc),
    zoomJoinUrl: parseJoinUrl(text),
    meetingId: pickLine(text, ["会议号", "會議號", "Meeting ID"])?.replace(/\s+/g, " ").trim() || null,
    passcode: pickLine(text, ["密码", "密碼", "Passcode", "Password"]) || null,
    rawInviteText: rawText,
  };
}
