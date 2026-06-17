export type BookingSource = "manual" | "zoom" | "admin" | "admin_zoom";

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

export type ParsedZoomInvite = {
  invitedByName: string | null;
  title: string;
  originalTimeText: string;
  sourceTimeZone: string;
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
};
