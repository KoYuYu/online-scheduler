export type BookingSource = "manual" | "zoom" | "admin" | "admin_zoom";

export type BookingAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  createdAt?: string;
};

export type BookingAttachmentInput = {
  fileName?: string | null;
  mimeType?: string | null;
  dataBase64?: string | null;
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

export type Booking = {
  id: string;
  source: BookingSource;
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  bookerName: string | null;
  bookerEmail: string | null;
  notes: string | null;
  invitedByName: string | null;
  zoomJoinUrl: string | null;
  meetingId: string | null;
  passcode: string | null;
  rawInviteText: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentDataBase64: string | null;
  attachments: BookingAttachment[];
  reminder24hSentAt: string | null;
  reminder24hLastError: string | null;
  reminder1hSentAt: string | null;
  reminder1hLastError: string | null;
  status: "confirmed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityRule = {
  id: string;
  weekday: number;
  startTimeLocal: string;
  endTimeLocal: string;
  slotMinutes: number;
  timezone: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicSlot = {
  id: string;
  startAtUtc: string;
  endAtUtc: string;
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string;
  timeLabel: string;
  status?: "available" | "blocked";
};

export const ZOOM_TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "美東時間（ET）" },
  { value: "America/Los_Angeles", label: "太平洋時間（PT）" },
  { value: "America/Chicago", label: "中部時間（CT）" },
  { value: "America/Denver", label: "山區時間（MT）" },
  { value: "Asia/Taipei", label: "台北時間" },
] as const;

export function isSupportedZoomTimeZone(value: string): boolean {
  return ZOOM_TIME_ZONE_OPTIONS.some((option) => option.value === value);
}

export type ParsedZoomInvite = {
  invitedByName: string | null;
  title: string;
  originalTimeText: string;
  sourceTimeZone: string;
  timeZoneConfirmed: boolean;
  timeZoneSource: "invite" | "user" | "missing";
  startAtUtc: string;
  endAtUtc: string;
  startAtEastern: string;
  endAtEastern: string;
  easternTimeLabel: string;
  zoomJoinUrl: string | null;
  meetingId: string | null;
  passcode: string | null;
  rawInviteText: string;
};

export type BookingInput = {
  source: BookingSource;
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  bookerName?: string | null;
  bookerEmail?: string | null;
  notes?: string | null;
  invitedByName?: string | null;
  zoomJoinUrl?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  rawInviteText?: string | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentDataBase64?: string | null;
  attachments?: BookingAttachmentInput[];
  appendAttachments?: BookingAttachmentInput[];
  removeAttachmentIds?: string[];
  clearAttachments?: boolean;
};
