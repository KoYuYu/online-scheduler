"use client";

import {
  AlertCircle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Link,
  RotateCw,
  Send,
  User,
  X,
} from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { addDaysToYmd, EASTERN_TIME_ZONE, formatYmd, ymdToWeekday } from "@/lib/time";
import { ZOOM_TIME_ZONE_OPTIONS, type ParsedZoomInvite, type PublicSlot } from "@/lib/types";

type ParseResponse = {
  preview?: ParsedZoomInvite;
  available?: boolean;
  suggestions?: PublicSlot[];
  error?: string;
};

type BookingMessage = {
  type: "success" | "error" | "warning";
  text: string;
};

type AttachmentState = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
};

type ConfirmedBookingSummary = {
  id?: string;
  source: "manual" | "zoom";
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  zoomJoinUrl?: string | null;
  notes?: string | null;
};

type BookingSuccessState = {
  bookings: ConfirmedBookingSummary[];
};

type Language = "zh" | "en";

const publicCopy = {
  zh: {
    appTitle: "線上預約系統",
    availabilityWindow: "週一至週五 晚上 8:00 到凌晨 12:00（美東）；週六、週日 早上 10:00 到下午 1:00、晚上 7:00 到凌晨 12:00（美東）",
    slotCadence: "60 分鐘，每 30 分鐘可選",
    adminLink: "管理後台",
    publicAvailability: "公開可預約時間",
    chooseSlotHeading: "選擇可預約時段",
    privacyNote: "預約細節不會公開顯示。",
    today: "今天",
    weekSwitchAria: "週切換",
    previousWeek: "上一週",
    nextWeek: "下一週",
    refresh: "重新整理",
    thisWeek: "本週",
    weeksLater: (count: number) => `${count} 週後`,
    availableSlots: "可預約時段",
    booked: "已預約",
    timezone: "時區",
    easternShort: "美東",
    loading: "載入中",
    noSlots: "無時段",
    noAvailableSlots: "無可預約時段",
    todayChip: "今天",
    availableShort: "可約",
    bookedShort: "已約",
    booking: "預約",
    confirmRequest: "確認預約",
    bookingMethod: "預約方式",
    pickSlot: "選擇時段",
    pasteZoom: "貼上 Zoom",
    confirmManualBooking: "確認手動預約",
    confirmSlotCount: (count: number) => `確認 ${count} 個時段`,
    zoomInviteText: "Zoom 邀請內容",
    zoomInvitePlaceholder: "貼上完整 Zoom 邀請內容，系統會自動抓取會議時間與連結。",
    submitZoomBooking: "提交 Zoom 預約",
    selectedSlotPrompt: "請先從行事曆選擇一個或多個可預約時段。",
    selectedSlots: "已選時段",
    selectedCount: (count: number) => `${count} 個`,
    selectedMobileSummary: (count: number) => `已選 ${count} 個時段`,
    continueBooking: "繼續預約",
    removeSlotTitle: "移除時段",
    name: "姓名",
    topicPlaceholder: "例如：System Design Interview",
    zoomLink: "Zoom 連結",
    notes: "備註",
    notesPlaceholder: "可選填會議背景或補充資訊",
    attachments: "附件",
    attachmentHelp: "可選填，最多 5MB。",
    removeAttachmentTitle: "移除附件",
    invitedBy: "邀請人",
    topic: "主題",
    originalTime: "原始時間",
    easternTime: "美東時間",
    meetingId: "會議號",
    passcode: "密碼",
    notProvided: "未提供",
    noValue: "無",
    linkNotFound: "未找到連結",
    confirmTimezone: "請先確認原始時區",
    availableToBook: "可預約",
    unavailableToBook: "此時段不可預約",
    zoomBooking: "Zoom 預約",
    chooseOriginalTimezone: "請確認會議原始時區",
    confirmBookingInfo: "確認預約資訊",
    timeUnavailable: "這個時間目前無法預約",
    sourceTimezone: "會議原始時區",
    chooseInviteTimezone: "請選擇邀請使用的時區",
    timezoneHelp: "選擇後系統會重新計算美東時間與可預約狀態。",
    cancel: "取消",
    close: "關閉",
    confirmAndBook: "確認並預約",
    manualBooking: "手動預約",
    missingTopicTitle: "請填寫會議主題",
    missingTopicWarning: "手動預約需要會議主題。",
    missingTopicCopy: "請返回表單補上主題，這樣管理員後台與提醒通知才看得出這次會議內容。",
    backToAddTopic: "返回填主題",
    missingZoomTitle: "未提供 Zoom 連結",
    missingZoomWarning: "這次預約沒有 Zoom 連結。",
    missingZoomCopy: (count: number) => `系統仍會建立 ${count} 個預約並封鎖時段，但管理員之後可能需要補上會議連結。`,
    backToAddLink: "返回補連結",
    submitAnyway: "仍然送出",
    successTitle: "預約已建立",
    successCopy: "這段時間已保留。你可以下載行事曆檔留存。",
    successBatchCopy: (count: number) => `${count} 個時段已保留。你可以下載行事曆檔留存。`,
    bookingDetails: "預約明細",
    addToCalendar: "下載行事曆檔",
    done: "完成",
    parseConfidence: "解析狀態",
    confidenceHigh: "看起來完整",
    confidenceMedium: "請快速確認",
    confidenceNeedsReview: "需要補充",
    parseMissingItems: "需確認",
    missingZoomLink: "缺少 Zoom 連結",
    missingMeetingId: "缺少會議號",
    missingPasscode: "缺少密碼",
    missingInviter: "缺少邀請人",
    missingSourceTimezone: "缺少原始時區",
    alternativeTimes: "可改選時段",
    closeDialogLabel: "關閉確認視窗",
    languageAria: "切換語言",
    chinese: "中文",
    english: "EN",
    etSuffix: "（美東）",
    loadSlotsError: "無法載入可預約時段。",
    parseZoomError: "無法解析 Zoom 邀請。",
    zoomParseFailed: "Zoom 解析失敗。",
    bookingSuccess: "預約已確認，這段時間已保留。",
    bookingBatchSuccess: (count: number) => `已確認 ${count} 個預約，這些時間已保留。`,
    pickAtLeastOne: "請先選擇至少一個可預約時段。",
    selectedBlocked: "已選時段中有時間剛剛被預約，請重新選擇。",
    selectedOverlap: "這個時段與已選時間重疊，請選擇另一個時段。",
    nameRequired: "請填寫姓名。",
    bookingFailed: "預約失敗。",
    partialBookingFailed: (count: number, detail: string) => `已建立 ${count} 個預約，但後續預約失敗：${detail}`,
    confirmZoomFirst: "請先確認 Zoom 邀請內容與可預約時間。",
    fileTooLarge: (fileName: string) => `${fileName} 超過 5MB，請重新選擇。`,
    attachmentReadFailed: "附件讀取失敗，請重新上傳。",
  },
  en: {
    appTitle: "Online Scheduler",
    availabilityWindow: "Mon-Fri 8:00 PM-12:00 AM ET; Sat-Sun 10:00 AM-1:00 PM and 7:00 PM-12:00 AM ET",
    slotCadence: "60 minutes, selectable every 30 minutes",
    adminLink: "Admin",
    publicAvailability: "Public Availability",
    chooseSlotHeading: "Choose a Time",
    privacyNote: "Booking details are never shown publicly.",
    today: "Today",
    weekSwitchAria: "Week navigation",
    previousWeek: "Previous Week",
    nextWeek: "Next Week",
    refresh: "Refresh",
    thisWeek: "This Week",
    weeksLater: (count: number) => `${count} Week${count > 1 ? "s" : ""} Later`,
    availableSlots: "Available Slots",
    booked: "Booked",
    timezone: "Time Zone",
    easternShort: "ET",
    loading: "Loading",
    noSlots: "No slots",
    noAvailableSlots: "No available slots",
    todayChip: "Today",
    availableShort: "available",
    bookedShort: "booked",
    booking: "Booking",
    confirmRequest: "Confirm Booking",
    bookingMethod: "Booking method",
    pickSlot: "Pick a Slot",
    pasteZoom: "Paste Zoom",
    confirmManualBooking: "Confirm Manual Booking",
    confirmSlotCount: (count: number) => `Confirm ${count} Slots`,
    zoomInviteText: "Zoom Invite Text",
    zoomInvitePlaceholder: "Paste the full Zoom invite. The system will extract the meeting time and link.",
    submitZoomBooking: "Submit Zoom Booking",
    selectedSlotPrompt: "Select one or more available times from the calendar first.",
    selectedSlots: "Selected Times",
    selectedCount: (count: number) => `${count} selected`,
    selectedMobileSummary: (count: number) => `${count} selected`,
    continueBooking: "Continue",
    removeSlotTitle: "Remove time",
    name: "Name",
    topicPlaceholder: "Example: System Design Interview",
    zoomLink: "Zoom Link",
    notes: "Notes",
    notesPlaceholder: "Optional meeting background or extra details",
    attachments: "Attachments",
    attachmentHelp: "Optional, up to 5MB.",
    removeAttachmentTitle: "Remove attachment",
    invitedBy: "Invited By",
    topic: "Topic",
    originalTime: "Original Time",
    easternTime: "Eastern Time",
    meetingId: "Meeting ID",
    passcode: "Passcode",
    notProvided: "Not provided",
    noValue: "None",
    linkNotFound: "No link found",
    confirmTimezone: "Confirm the original time zone first",
    availableToBook: "Available to Book",
    unavailableToBook: "This Time Is Unavailable",
    zoomBooking: "Zoom Booking",
    chooseOriginalTimezone: "Confirm Original Time Zone",
    confirmBookingInfo: "Confirm Booking Details",
    timeUnavailable: "This time is unavailable",
    sourceTimezone: "Original Meeting Time Zone",
    chooseInviteTimezone: "Select the invite time zone",
    timezoneHelp: "After selection, the system recalculates Eastern Time and availability.",
    cancel: "Cancel",
    close: "Close",
    confirmAndBook: "Confirm and Book",
    manualBooking: "Manual Booking",
    missingTopicTitle: "Meeting Topic Required",
    missingTopicWarning: "Manual bookings need a meeting topic.",
    missingTopicCopy: "Go back and add a topic so the admin view and reminder notifications clearly show what this meeting is for.",
    backToAddTopic: "Add Topic",
    missingZoomTitle: "No Zoom Link Provided",
    missingZoomWarning: "This booking does not include a Zoom link.",
    missingZoomCopy: (count: number) => `The system will still create ${count} booking${count > 1 ? "s" : ""} and block the time. The admin may add the meeting link later.`,
    backToAddLink: "Go Back",
    submitAnyway: "Submit Anyway",
    successTitle: "Booking Created",
    successCopy: "This time is reserved. You can download a calendar file for your records.",
    successBatchCopy: (count: number) => `${count} times are reserved. You can download a calendar file for your records.`,
    bookingDetails: "Booking Details",
    addToCalendar: "Download Calendar File",
    done: "Done",
    parseConfidence: "Parse Status",
    confidenceHigh: "Looks Complete",
    confidenceMedium: "Review Quickly",
    confidenceNeedsReview: "Needs Input",
    parseMissingItems: "Check",
    missingZoomLink: "Missing Zoom link",
    missingMeetingId: "Missing meeting ID",
    missingPasscode: "Missing passcode",
    missingInviter: "Missing inviter",
    missingSourceTimezone: "Missing original time zone",
    alternativeTimes: "Alternative Times",
    closeDialogLabel: "Close confirmation dialog",
    languageAria: "Switch language",
    chinese: "中文",
    english: "EN",
    etSuffix: " ET",
    loadSlotsError: "Unable to load available times.",
    parseZoomError: "Unable to parse the Zoom invite.",
    zoomParseFailed: "Zoom parsing failed.",
    bookingSuccess: "Booking confirmed. This time is now reserved.",
    bookingBatchSuccess: (count: number) => `${count} bookings confirmed. These times are now reserved.`,
    pickAtLeastOne: "Select at least one available time first.",
    selectedBlocked: "One of the selected times was just booked. Please choose again.",
    selectedOverlap: "This time overlaps another selected time. Please choose a different slot.",
    nameRequired: "Please enter your name.",
    bookingFailed: "Booking failed.",
    partialBookingFailed: (count: number, detail: string) => `${count} booking${count > 1 ? "s" : ""} created, but the next booking failed: ${detail}`,
    confirmZoomFirst: "Please confirm the Zoom invite details and availability first.",
    fileTooLarge: (fileName: string) => `${fileName} is larger than 5MB. Please choose another file.`,
    attachmentReadFailed: "Unable to read the attachment. Please upload it again.",
  },
} as const;

const maxWeekOffset = 3;
const maxAttachmentBytes = 5 * 1024 * 1024;
const weekdayLabels: Record<Language, string[]> = {
  zh: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

type PublicCopy = (typeof publicCopy)[Language];

type SlotDisplayItem =
  | {
      type: "available";
      id: string;
      sortStartAtUtc: string;
      sortEndAtUtc: string;
      slot: PublicSlot;
    }
  | {
      type: "blocked";
      id: string;
      startAtUtc: string;
      endAtUtc: string;
      sortStartAtUtc: string;
      sortEndAtUtc: string;
    };

export function PublicScheduler() {
  const [language, setLanguage] = useState<Language>("zh");
  const [todayYmd] = useState(() => formatYmd(new Date(), EASTERN_TIME_ZONE));
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<PublicSlot[]>([]);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"calendar" | "zoom">("calendar");
  const [bookerName, setBookerName] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [zoomJoinUrl, setZoomJoinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<AttachmentState[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [zoomText, setZoomText] = useState("");
  const [preview, setPreview] = useState<ParsedZoomInvite | null>(null);
  const [suggestions, setSuggestions] = useState<PublicSlot[]>([]);
  const [previewAvailable, setPreviewAvailable] = useState<boolean | null>(null);
  const [selectedSourceTimeZone, setSelectedSourceTimeZone] = useState("");
  const [showMissingTopicConfirm, setShowMissingTopicConfirm] = useState(false);
  const [showMissingZoomConfirm, setShowMissingZoomConfirm] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessState | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<BookingMessage | null>(null);
  const slotsRequestId = useRef(0);
  const bookingPanelRef = useRef<HTMLElement | null>(null);
  const bookingTitleInputRef = useRef<HTMLInputElement | null>(null);
  const copy = publicCopy[language];

  const currentWeekStartYmd = useMemo(() => startOfWeekYmd(todayYmd), [todayYmd]);
  const weekRange = useMemo(() => buildWeekRange(currentWeekStartYmd, weekOffset), [currentWeekStartYmd, weekOffset]);
  const todayLabel = useMemo(() => formatDateKeyLong(todayYmd, language), [language, todayYmd]);
  const weekLabel = useMemo(() => `${formatDateKeyShort(weekRange.fromYmd, language)} - ${formatDateKeyShort(weekRange.toYmd, language)}`, [language, weekRange]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const dateKey = addDaysToYmd(weekRange.fromYmd, index);
        return {
          dateKey,
          dateLabel: formatDateKeyShort(dateKey, language),
          isToday: dateKey === todayYmd,
          weekdayLabel: weekdayLabels[language][ymdToWeekday(dateKey)],
        };
      }),
    [language, todayYmd, weekRange]
  );

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("scheduler-language");
    if (storedLanguage === "zh" || storedLanguage === "en") {
      setLanguage(storedLanguage);
    }
  }, []);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("scheduler-language", nextLanguage);
  }

  async function loadSlots(offset = weekOffset, options: { clearSelection?: boolean } = {}) {
    const requestId = slotsRequestId.current + 1;
    slotsRequestId.current = requestId;
    const range = buildWeekRange(currentWeekStartYmd, offset);
    const params = new URLSearchParams({ from: range.fromYmd, to: range.toYmd });
    setSlotsLoading(true);
    setSlots([]);
    if (options.clearSelection) {
      setSelectedSlots([]);
    }

    try {
      const response = await fetch(`/api/availability?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as { slots: PublicSlot[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || copy.loadSlotsError);
      }
      if (requestId !== slotsRequestId.current) {
        return;
      }
      const nextSlots = data.slots || [];
      setSlots(nextSlots);
      setSelectedSlots((current) =>
        current
          .map((selected) => nextSlots.find((slot) => slot.id === selected.id && slot.status !== "blocked"))
          .filter((slot): slot is PublicSlot => Boolean(slot))
      );
    } catch (error) {
      if (requestId === slotsRequestId.current) {
        setMessage({ type: "error", text: translateServerMessage(error instanceof Error ? error.message : copy.loadSlotsError, language) });
      }
    } finally {
      if (requestId === slotsRequestId.current) {
        setSlotsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadSlots(weekOffset, { clearSelection: true });
  }, [weekOffset]);

  useEffect(() => {
    const defaultDay = weekDays.find((day) => day.isToday) || weekDays[0];
    setExpandedDayKey(defaultDay?.dateKey || null);
  }, [weekRange.fromYmd, weekDays]);

  const slotsByDate = useMemo(() => {
    const groups = new Map<string, PublicSlot[]>();
    for (const slot of slots) {
      const existing = groups.get(slot.dateKey) || [];
      existing.push(slot);
      groups.set(slot.dateKey, existing);
    }
    return groups;
  }, [slots]);
  const availableSlotCount = useMemo(() => slots.filter((slot) => slot.status !== "blocked").length, [slots]);
  const blockedSlotCount = useMemo(() => countBlockedRanges(slots), [slots]);
  const selectedSlotIds = useMemo(() => new Set(selectedSlots.map((slot) => slot.id)), [selectedSlots]);
  const activeDay = useMemo(
    () => weekDays.find((day) => day.dateKey === expandedDayKey) || weekDays.find((day) => day.isToday) || weekDays[0],
    [expandedDayKey, weekDays]
  );
  const activeDaySlots = activeDay ? slotsByDate.get(activeDay.dateKey) || [] : [];
  const activeDaySlotItems = useMemo(() => buildSlotDisplayItems(activeDaySlots), [activeDaySlots]);
  const showMobileSelectedBar = mode === "calendar" && selectedSlots.length > 0;

  async function requestZoomPreview(sourceTimeZone?: string) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/zoom-invites/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: zoomText, sourceTimeZone }),
      });
      const data = (await response.json()) as ParseResponse;
      if (!response.ok || !data.preview) {
        throw new Error(data.error || copy.parseZoomError);
      }
      setPreview(data.preview);
      setPreviewAvailable(Boolean(data.available));
      setSuggestions(data.available ? [] : data.suggestions || []);
    } catch (error) {
      setMessage({ type: "error", text: translateServerMessage(error instanceof Error ? error.message : copy.zoomParseFailed, language) });
    } finally {
      setLoading(false);
    }
  }

  async function openZoomConfirmation() {
    setPreview(null);
    setSuggestions([]);
    setPreviewAvailable(null);
    setSelectedSourceTimeZone("");
    await requestZoomPreview();
  }

  async function confirmSourceTimeZone(sourceTimeZone: string) {
    setSelectedSourceTimeZone(sourceTimeZone);
    await requestZoomPreview(sourceTimeZone);
  }

  async function createBooking(payload: Record<string, unknown>, successSummary: ConfirmedBookingSummary) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        booking?: { id?: string; title?: string; startAtUtc?: string; endAtUtc?: string };
        error?: string;
        suggestions?: PublicSlot[];
      };
      if (!response.ok) {
        setSuggestions(data.suggestions || []);
        if (payload.source === "zoom") {
          setPreviewAvailable(false);
        }
        throw new Error(data.error || copy.bookingFailed);
      }
      setMessage({ type: "success", text: copy.bookingSuccess });
      setBookingSuccess({
        bookings: [
          {
            ...successSummary,
            id: data.booking?.id || successSummary.id,
            title: data.booking?.title || successSummary.title,
            startAtUtc: data.booking?.startAtUtc || successSummary.startAtUtc,
            endAtUtc: data.booking?.endAtUtc || successSummary.endAtUtc,
          },
        ],
      });
      setMode("calendar");
      setSelectedSlots([]);
      setPreview(null);
      setPreviewAvailable(null);
      setSuggestions([]);
      setSelectedSourceTimeZone("");
      setZoomText("");
      setBookerName("");
      setBookingTitle("");
      setZoomJoinUrl("");
      setNotes("");
      clearAttachments();
      void loadSlots(weekOffset);
    } catch (error) {
      setMessage({ type: "error", text: translateServerMessage(error instanceof Error ? error.message : copy.bookingFailed, language) });
    } finally {
      setLoading(false);
    }
  }

  function toggleSlotSelection(slot: PublicSlot) {
    if (slot.status === "blocked") {
      return;
    }
    setMode("calendar");
    setExpandedDayKey(slot.dateKey);
    setMessage(null);
    const isSelected = selectedSlots.some((selected) => selected.id === slot.id);
    if (!isSelected && selectedSlots.some((selected) => rangesOverlap(selected, slot))) {
      setMessage({ type: "error", text: copy.selectedOverlap });
      return;
    }
    setSelectedSlots((current) =>
      current.some((selected) => selected.id === slot.id)
        ? current.filter((selected) => selected.id !== slot.id)
        : [...current, slot].sort(compareSlotsByStart)
    );
  }

  function removeSelectedSlot(slotId: string) {
    setSelectedSlots((current) => current.filter((slot) => slot.id !== slotId));
  }

  function submitManual() {
    void submitManualBookings();
  }

  async function submitManualBookings(options: { allowMissingZoom?: boolean } = {}) {
    if (!selectedSlots.length) {
      setMessage({ type: "error", text: copy.pickAtLeastOne });
      return;
    }
    const blockedSelection = selectedSlots.find((slot) => slot.status === "blocked");
    if (blockedSelection) {
      setMessage({ type: "error", text: copy.selectedBlocked });
      setSelectedSlots((current) => current.filter((slot) => slot.status !== "blocked"));
      return;
    }
    if (!bookerName.trim()) {
      setMessage({ type: "error", text: copy.nameRequired });
      return;
    }
    if (!bookingTitle.trim()) {
      setShowMissingTopicConfirm(true);
      return;
    }
    if (!zoomJoinUrl.trim() && !options.allowMissingZoom) {
      setShowMissingZoomConfirm(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    setShowMissingTopicConfirm(false);
    setShowMissingZoomConfirm(false);
    const attachmentPayload = buildAttachmentPayload(attachments);
    const zoomUrl = zoomJoinUrl.trim() || null;
    const manualTitle = bookingTitle.trim();
    try {
      const response = await fetch("/api/bookings/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          title: manualTitle,
          bookerName,
          zoomJoinUrl: zoomUrl,
          notes,
          slots: selectedSlots.map((slot) => ({ startAtUtc: slot.startAtUtc, endAtUtc: slot.endAtUtc })),
          ...attachmentPayload,
        }),
      });
      const data = (await response.json()) as {
        bookings?: Array<{ id?: string; title?: string; startAtUtc?: string; endAtUtc?: string }>;
        error?: string;
        suggestions?: PublicSlot[];
      };
      if (!response.ok) {
        setSuggestions(data.suggestions || []);
        throw new Error(data.error || copy.bookingFailed);
      }
      const createdBookings: ConfirmedBookingSummary[] = (data.bookings || []).map((booking, index) => ({
        id: booking.id,
        source: "manual",
        title: booking.title || manualTitle,
        startAtUtc: booking.startAtUtc || selectedSlots[index].startAtUtc,
        endAtUtc: booking.endAtUtc || selectedSlots[index].endAtUtc,
        zoomJoinUrl: zoomUrl,
        notes,
      }));

      setMessage({
        type: "success",
        text: selectedSlots.length > 1 ? copy.bookingBatchSuccess(selectedSlots.length) : copy.bookingSuccess,
      });
      setBookingSuccess({ bookings: createdBookings });
      setMode("calendar");
      setSelectedSlots([]);
      setBookerName("");
      setBookingTitle("");
      setZoomJoinUrl("");
      setNotes("");
      clearAttachments();
      void loadSlots(weekOffset);
    } catch (error) {
      const detail = translateServerMessage(error instanceof Error ? error.message : copy.bookingFailed, language);
      setMessage({ type: "error", text: detail });
      void loadSlots(weekOffset);
    } finally {
      setLoading(false);
    }
  }

  function submitZoom() {
    if (!preview || !previewAvailable || !preview.timeZoneConfirmed) {
      setMessage({ type: "error", text: copy.confirmZoomFirst });
      return;
    }
    void createBooking(
      {
        source: "zoom",
        rawInviteText: zoomText,
        sourceTimeZone: selectedSourceTimeZone || undefined,
        notes,
        ...buildAttachmentPayload(attachments),
      },
      {
        source: "zoom",
        title: preview.title,
        startAtUtc: preview.startAtUtc,
        endAtUtc: preview.endAtUtc,
        zoomJoinUrl: preview.zoomJoinUrl,
        notes,
      }
    );
  }

  async function handleAttachmentChange(files: FileList | null) {
    setAttachmentError(null);
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) {
      return;
    }
    const oversizedFile = selectedFiles.find((file) => file.size > maxAttachmentBytes);
    if (oversizedFile) {
      setAttachmentError(copy.fileTooLarge(oversizedFile.name));
      setAttachmentInputKey((current) => current + 1);
      return;
    }

    try {
      const nextAttachments = await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64: await readFileAsBase64(file),
          sizeBytes: file.size,
        }))
      );
      setAttachments((current) => [...current, ...nextAttachments]);
    } catch {
      setAttachmentError(copy.attachmentReadFailed);
      setAttachmentInputKey((current) => current + 1);
    }
  }

  function clearAttachments() {
    setAttachments([]);
    setAttachmentError(null);
    setAttachmentInputKey((current) => current + 1);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setAttachmentError(null);
    setAttachmentInputKey((current) => current + 1);
  }

  function pickSuggestion(slot: PublicSlot) {
    dismissZoomConfirmation();
    setMode("calendar");
    setSelectedSlots([slot]);
    setMessage(null);
  }

  function dismissZoomConfirmation() {
    setPreview(null);
    setPreviewAvailable(null);
    setSuggestions([]);
    setSelectedSourceTimeZone("");
  }

  function scrollToBookingPanel() {
    bookingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const canGoPreviousWeek = weekOffset > 0;
  const canGoNextWeek = weekOffset < maxWeekOffset;

  return (
    <main className={`app-shell scheduler-shell ${showMobileSelectedBar ? "has-mobile-selected-bar" : ""}`} lang={language === "zh" ? "zh-Hant" : "en"}>
      <div className="topbar compact">
        <div className="brand">
          <div className="brand-mark">
            <img alt="" src="/icons/app-icon-fashion-192.png" />
          </div>
          <div>
            <h1>{copy.appTitle}</h1>
            <p>{copy.availabilityWindow}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="language-toggle" aria-label={copy.languageAria}>
            <button className={language === "zh" ? "active" : ""} type="button" onClick={() => updateLanguage("zh")}>
              {copy.chinese}
            </button>
            <button className={language === "en" ? "active" : ""} type="button" onClick={() => updateLanguage("en")}>
              {copy.english}
            </button>
          </div>
          <span className="window-badge">
            <Clock size={15} />
            {copy.slotCadence}
          </span>
        </div>
      </div>

      <section className="scheduler-layout">
        <section className="surface calendar-surface" aria-labelledby="available-times-heading">
          <div className="surface-header">
            <div>
              <span className="section-kicker">{copy.publicAvailability}</span>
              <h2 id="available-times-heading">{copy.chooseSlotHeading}</h2>
              <p className="muted">
                {copy.availabilityWindow}{language === "zh" ? "。" : ". "}{copy.privacyNote}
              </p>
              <p className="today-line">
                {copy.today}: <strong>{todayLabel}</strong>
              </p>
            </div>
            <div className="week-actions" aria-label={copy.weekSwitchAria}>
              {canGoPreviousWeek ? (
                <button className="ghost-button compact-button" type="button" onClick={() => setWeekOffset((current) => Math.max(0, current - 1))}>
                  <ChevronLeft size={16} />
                  {copy.previousWeek}
                </button>
              ) : null}
              {canGoNextWeek ? (
                <button
                  className="ghost-button compact-button"
                  type="button"
                  onClick={() => setWeekOffset((current) => Math.min(maxWeekOffset, current + 1))}
                >
                  {copy.nextWeek}
                  <ChevronRight size={16} />
                </button>
              ) : null}
              <button className="ghost-button compact-button" type="button" onClick={() => void loadSlots(weekOffset)}>
                <RotateCw size={16} />
                {copy.refresh}
              </button>
            </div>
          </div>

          <div className="calendar-toolbar" aria-label="可預約時間摘要">
            <div>
              <strong>{weekOffset === 0 ? copy.thisWeek : copy.weeksLater(weekOffset)}</strong>
              <span>{weekLabel}</span>
            </div>
            <div>
              <strong>{slotsLoading ? "..." : availableSlotCount}</strong>
              <span>{copy.availableSlots}</span>
            </div>
            <div>
              <strong>{slotsLoading ? "..." : blockedSlotCount}</strong>
              <span>{copy.booked}</span>
            </div>
            <div>
              <strong>{copy.easternShort}</strong>
              <span>{copy.timezone}</span>
            </div>
          </div>

          <div className="public-date-focus-layout">
            <nav className="date-rail public-date-rail" aria-label={copy.chooseSlotHeading}>
              {weekDays.map((day) => {
                const daySlots = slotsByDate.get(day.dateKey) || [];
                const availableCount = daySlots.filter((slot) => slot.status !== "blocked").length;
                const blockedCount = countBlockedRanges(daySlots);
                const active = activeDay.dateKey === day.dateKey;
                return (
                  <button
                    aria-pressed={active}
                    className={`${active ? "active" : ""} ${day.isToday ? "today" : ""}`}
                    key={day.dateKey}
                    type="button"
                    onClick={() => setExpandedDayKey(day.dateKey)}
                  >
                    <span>{day.weekdayLabel}</span>
                    <strong>{day.dateLabel}</strong>
                    {day.isToday ? <span className="today-chip">{copy.todayChip}</span> : null}
                    <small>
                      {slotsLoading
                        ? copy.loading
                        : daySlots.length
                          ? `${availableCount} ${copy.availableShort}${blockedCount ? ` / ${blockedCount} ${copy.bookedShort}` : ""}`
                          : copy.noSlots}
                    </small>
                  </button>
                );
              })}
            </nav>

            <section className="slot-focus-panel public-slot-focus" aria-live="polite">
              <div className="focus-panel-head">
                <div>
                  <span className="section-kicker">{activeDay ? formatDateKeyLong(activeDay.dateKey, language) : copy.publicAvailability}</span>
                  <h3>
                    {activeDay?.weekdayLabel}
                    {activeDay?.isToday ? ` · ${copy.todayChip}` : ""}{language === "zh" ? "可預約時段" : " Available Times"}
                  </h3>
                </div>
                <span className="pill">{copy.easternShort}</span>
              </div>
              <div className="focus-slot-grid public-focus-slot-grid">
                {slotsLoading ? (
                  <div className="no-slots">{copy.loading}...</div>
                ) : activeDaySlotItems.length ? (
                  activeDaySlotItems.map((item) => {
                    if (item.type === "blocked") {
                      return (
                        <button className="slot-button blocked merged-blocked-slot" disabled key={item.id} type="button">
                          <Clock size={15} />
                          <span>
                            {formatEtTimeRange(item.startAtUtc, item.endAtUtc, language)}
                            <small>{copy.booked}</small>
                          </span>
                        </button>
                      );
                    }
                    const slot = item.slot;
                    const selected = selectedSlotIds.has(slot.id);
                    return (
                      <button
                        aria-pressed={selected}
                        className={`slot-button ${selected ? "selected" : ""}`}
                        key={slot.id}
                        type="button"
                        onClick={() => toggleSlotSelection(slot)}
                      >
                        <Clock size={15} />
                        <span>{formatEtTimeRange(slot.startAtUtc, slot.endAtUtc, language)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="no-slots">{copy.noAvailableSlots}</div>
                )}
              </div>
            </section>
          </div>
        </section>

        <aside className="surface booking-surface" ref={bookingPanelRef} aria-labelledby="booking-panel-heading">
          <div className="surface-header slim">
            <div>
              <span className="section-kicker">{copy.booking}</span>
              <h2 id="booking-panel-heading">{copy.confirmRequest}</h2>
            </div>
          </div>

          <div className="segmented-control" role="tablist" aria-label={copy.bookingMethod}>
            <button
              className={`segment-button ${mode === "calendar" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setMode("calendar");
                setMessage(null);
              }}
            >
              <CalendarCheck size={16} />
              {copy.pickSlot}
            </button>
            <button
              className={`segment-button ${mode === "zoom" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setMode("zoom");
                setMessage(null);
              }}
            >
              <Link size={16} />
              {copy.pasteZoom}
            </button>
          </div>

          {mode === "calendar" ? (
            <div className="form-stack">
              <SelectedSlotsSummary copy={copy} language={language} slots={selectedSlots} onRemove={removeSelectedSlot} />
              <BookingFields
                bookingTitleInputRef={bookingTitleInputRef}
                bookerName={bookerName}
                bookingTitle={bookingTitle}
                copy={copy}
                notes={notes}
                zoomJoinUrl={zoomJoinUrl}
                setBookerName={setBookerName}
                setBookingTitle={setBookingTitle}
                setNotes={setNotes}
                setZoomJoinUrl={setZoomJoinUrl}
              />
              <AttachmentField
                attachments={attachments}
                copy={copy}
                error={attachmentError}
                inputKey={attachmentInputKey}
                onChange={(files) => void handleAttachmentChange(files)}
                onRemove={removeAttachment}
              />
              <button
                className="primary-button"
                disabled={loading || !selectedSlots.length || !bookerName.trim()}
                type="button"
                onClick={submitManual}
              >
                <Check size={17} />
                {selectedSlots.length > 1 ? copy.confirmSlotCount(selectedSlots.length) : copy.confirmManualBooking}
              </button>
            </div>
          ) : (
            <div className="form-stack">
              <label className="field">
                <span>{copy.zoomInviteText}</span>
                <textarea
                  placeholder={copy.zoomInvitePlaceholder}
                  value={zoomText}
                  onChange={(event) => setZoomText(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{copy.notes}</span>
                <input placeholder={copy.notesPlaceholder} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <AttachmentField
                attachments={attachments}
                copy={copy}
                error={attachmentError}
                inputKey={attachmentInputKey}
                onChange={(files) => void handleAttachmentChange(files)}
                onRemove={removeAttachment}
              />
              <button className="primary-button" disabled={loading || !zoomText.trim()} type="button" onClick={() => void openZoomConfirmation()}>
                <Send size={17} />
                {copy.submitZoomBooking}
              </button>
            </div>
          )}

          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </aside>

        {preview ? (
          <ZoomConfirmationDialog
            available={previewAvailable}
            copy={copy}
            language={language}
            loading={loading}
            message={message}
            notes={notes}
            preview={preview}
            selectedSourceTimeZone={selectedSourceTimeZone}
            suggestions={suggestions}
            onCancel={dismissZoomConfirmation}
            onConfirm={submitZoom}
            onPickSuggestion={pickSuggestion}
            onSourceTimeZoneChange={(timeZone) => void confirmSourceTimeZone(timeZone)}
          />
        ) : null}
        {showMissingZoomConfirm ? (
          <MissingZoomConfirmationDialog
            loading={loading}
            copy={copy}
            slotCount={selectedSlots.length}
            onCancel={() => setShowMissingZoomConfirm(false)}
            onConfirm={() => void submitManualBookings({ allowMissingZoom: true })}
          />
        ) : null}
        {showMissingTopicConfirm ? (
          <MissingTopicDialog
            copy={copy}
            onClose={() => {
              setShowMissingTopicConfirm(false);
              window.setTimeout(() => bookingTitleInputRef.current?.focus(), 0);
            }}
          />
        ) : null}
        {bookingSuccess ? (
          <BookingSuccessDialog
            copy={copy}
            language={language}
            success={bookingSuccess}
            onAddToCalendar={() => downloadCalendarFile(bookingSuccess.bookings)}
            onClose={() => setBookingSuccess(null)}
          />
        ) : null}
      </section>
      {showMobileSelectedBar ? (
        <div className="mobile-selected-bar">
          <div>
            <strong>{copy.selectedMobileSummary(selectedSlots.length)}</strong>
            <span>{formatMobileSelectedSummary(selectedSlots, language)}</span>
          </div>
          <button className="primary-button" type="button" onClick={scrollToBookingPanel}>
            <Check size={16} />
            {copy.continueBooking}
          </button>
        </div>
      ) : null}
      <footer className="public-footer">
        <span>{copy.privacyNote}</span>
        <a href="/admin">{copy.adminLink}</a>
      </footer>
    </main>
  );
}

function buildAttachmentPayload(attachments: AttachmentState[]): Record<string, unknown> {
  if (!attachments.length) {
    return {};
  }
  return {
    attachments: attachments.map((attachment) => ({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      dataBase64: attachment.dataBase64,
    })),
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() || "" : result);
    };
    reader.onerror = () => reject(new Error("ATTACHMENT_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadCalendarFile(bookings: ConfirmedBookingSummary[]): void {
  if (!bookings.length) {
    return;
  }
  const calendarText = buildCalendarFile(bookings);
  const blob = new Blob([calendarText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = bookings.length === 1 ? `${toFileSlug(bookings[0].title)}.ics` : "online-scheduler-bookings.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildCalendarFile(bookings: ConfirmedBookingSummary[]): string {
  const now = formatIcsDate(new Date().toISOString());
  const events = bookings.map((booking, index) => {
    const description = [
      booking.zoomJoinUrl ? `Zoom: ${booking.zoomJoinUrl}` : "",
      booking.notes ? `Notes: ${booking.notes}` : "",
    ].filter(Boolean).join("\n");
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(booking.id || `${booking.startAtUtc}-${index}`)}@online-scheduler`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcsDate(booking.startAtUtc)}`,
      `DTEND:${formatIcsDate(booking.endAtUtc)}`,
      `SUMMARY:${escapeIcsText(booking.title)}`,
      description ? `DESCRIPTION:${escapeIcsText(description)}` : "",
      booking.zoomJoinUrl ? `URL:${booking.zoomJoinUrl}` : "",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Online Scheduler//Booking//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

function formatIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toFileSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "booking";
}

function startOfWeekYmd(ymd: string): string {
  return addDaysToYmd(ymd, -((ymdToWeekday(ymd) + 6) % 7));
}

function buildWeekRange(currentWeekStartYmd: string, weekOffset: number): { fromYmd: string; toYmd: string } {
  const fromYmd = addDaysToYmd(currentWeekStartYmd, weekOffset * 7);
  return { fromYmd, toYmd: addDaysToYmd(fromYmd, 6) };
}

function formatDateKeyShort(ymd: string, language: Language): string {
  const [, month, day] = ymd.split("-").map(Number);
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${ymd}T12:00:00Z`));
  }
  return `${month}月${day}日`;
}

function getEtParts(iso: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function formatEtTime(iso: string, language: Language): string {
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }
  const parts = getEtParts(iso);
  const period = parts.hour < 6 ? "凌晨" : parts.hour < 12 ? "早上" : parts.hour < 18 ? "下午" : "晚上";
  const hour = parts.hour % 12 || 12;
  return `${period} ${hour}:${String(parts.minute).padStart(2, "0")}`;
}

function formatEtTimeRange(startIso: string, endIso: string, language: Language): string {
  const suffix = publicCopy[language].etSuffix;
  return `${formatEtTime(startIso, language)} - ${formatEtTime(endIso, language)}${suffix}`;
}

function formatEtDateTimeRange(startIso: string, endIso: string, language: Language): string {
  const start = getEtParts(startIso);
  const end = getEtParts(endIso);
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  if (language === "en") {
    const startDate = new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(startIso));
    if (sameDay) {
      return `${startDate}, ${formatEtTimeRange(startIso, endIso, language)}`;
    }
    const endDate = new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(endIso));
    return `${startDate}, ${formatEtTime(startIso, language)} - ${endDate}, ${formatEtTime(endIso, language)} ET`;
  }
  const startDate = `${start.year}年${start.month}月${start.day}日`;
  if (sameDay) {
    return `${startDate} ${formatEtTimeRange(startIso, endIso, language)}`;
  }
  return `${startDate} ${formatEtTime(startIso, language)} - ${end.year}年${end.month}月${end.day}日 ${formatEtTime(endIso, language)}（美東）`;
}

function formatDateKeyLong(ymd: string, language: Language): string {
  const [year, month, day] = ymd.split("-").map(Number);
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${ymd}T12:00:00Z`));
  }
  return `${year}年${month}月${day}日`;
}

function compareSlotsByStart(left: PublicSlot, right: PublicSlot): number {
  return left.startAtUtc.localeCompare(right.startAtUtc);
}

function rangesOverlap(left: PublicSlot, right: PublicSlot): boolean {
  return new Date(left.startAtUtc).getTime() < new Date(right.endAtUtc).getTime()
    && new Date(left.endAtUtc).getTime() > new Date(right.startAtUtc).getTime();
}

function formatMobileSelectedSummary(slots: PublicSlot[], language: Language): string {
  const sortedSlots = [...slots].sort(compareSlotsByStart);
  const firstSlot = sortedSlots[0];
  if (!firstSlot) {
    return "";
  }
  const firstLabel = `${formatDateKeyShort(firstSlot.dateKey, language)}${language === "zh" ? "，" : ", "}${formatEtTimeRange(
    firstSlot.startAtUtc,
    firstSlot.endAtUtc,
    language
  )}`;
  const extraCount = sortedSlots.length - 1;
  if (extraCount <= 0) {
    return firstLabel;
  }
  return language === "zh" ? `${firstLabel}，另 ${extraCount} 個` : `${firstLabel}, +${extraCount} more`;
}

function buildSlotDisplayItems(slots: PublicSlot[]): SlotDisplayItem[] {
  const items: SlotDisplayItem[] = [];
  const blockedRanges = new Map<string, SlotDisplayItem>();

  for (const slot of slots) {
    if (slot.status === "blocked") {
      const blockedStartAtUtc = slot.blockedStartAtUtc || slot.startAtUtc;
      const blockedEndAtUtc = slot.blockedEndAtUtc || slot.endAtUtc;
      const id = `blocked_${blockedStartAtUtc}_${blockedEndAtUtc}`;
      if (!blockedRanges.has(id)) {
        blockedRanges.set(id, {
          type: "blocked",
          id,
          startAtUtc: blockedStartAtUtc,
          endAtUtc: blockedEndAtUtc,
          sortStartAtUtc: blockedStartAtUtc,
          sortEndAtUtc: blockedEndAtUtc,
        });
      }
      continue;
    }

    items.push({
      type: "available",
      id: slot.id,
      sortStartAtUtc: slot.startAtUtc,
      sortEndAtUtc: slot.endAtUtc,
      slot,
    });
  }

  items.push(...blockedRanges.values());
  return items.sort(
    (left, right) =>
      left.sortStartAtUtc.localeCompare(right.sortStartAtUtc) ||
      left.sortEndAtUtc.localeCompare(right.sortEndAtUtc) ||
      left.id.localeCompare(right.id)
  );
}

function countBlockedRanges(slots: PublicSlot[]): number {
  const ranges = new Set<string>();
  for (const slot of slots) {
    if (slot.status !== "blocked") {
      continue;
    }
    ranges.add(`${slot.blockedStartAtUtc || slot.startAtUtc}_${slot.blockedEndAtUtc || slot.endAtUtc}`);
  }
  return ranges.size;
}

function getZoomParseConfidence(preview: ParsedZoomInvite): { tone: "high" | "medium" | "needs-review"; label: string } {
  const missingItems = getZoomParseMissingItems(preview, publicCopy.zh);
  if (!preview.timeZoneConfirmed || !preview.zoomJoinUrl) {
    return { tone: "needs-review", label: publicCopy.zh.confidenceNeedsReview };
  }
  if (preview.timeZoneSource !== "invite" || missingItems.length) {
    return { tone: "medium", label: publicCopy.zh.confidenceMedium };
  }
  return { tone: "high", label: publicCopy.zh.confidenceHigh };
}

function getLocalizedZoomParseConfidence(preview: ParsedZoomInvite, copy: PublicCopy): { tone: "high" | "medium" | "needs-review"; label: string } {
  const base = getZoomParseConfidence(preview);
  const labels = {
    high: copy.confidenceHigh,
    medium: copy.confidenceMedium,
    "needs-review": copy.confidenceNeedsReview,
  };
  return { tone: base.tone, label: labels[base.tone] };
}

function getZoomParseMissingItems(preview: ParsedZoomInvite, copy: PublicCopy): string[] {
  const missingItems: string[] = [];
  if (!preview.timeZoneConfirmed) {
    missingItems.push(copy.missingSourceTimezone);
  }
  if (!preview.zoomJoinUrl) {
    missingItems.push(copy.missingZoomLink);
  }
  if (!preview.meetingId) {
    missingItems.push(copy.missingMeetingId);
  }
  if (!preview.passcode) {
    missingItems.push(copy.missingPasscode);
  }
  if (!preview.invitedByName) {
    missingItems.push(copy.missingInviter);
  }
  return missingItems;
}

function getZoomTimeZoneLabel(value: string, language: Language, fallback: string): string {
  if (language === "zh") {
    return fallback;
  }
  const labels: Record<string, string> = {
    "America/New_York": "Eastern Time (ET)",
    "America/Los_Angeles": "Pacific Time (PT)",
    "America/Chicago": "Central Time (CT)",
    "America/Denver": "Mountain Time (MT)",
    "Asia/Taipei": "Taipei Time",
  };
  return labels[value] || fallback;
}

function translateServerMessage(message: string, language: Language): string {
  if (language === "zh") {
    return message;
  }
  const translations: Record<string, string> = {
    "無法載入可預約時段。": "Unable to load available times.",
    "無法解析 Zoom 邀請。": "Unable to parse the Zoom invite.",
    "預約失敗。": "Booking failed.",
    "請先確認 Zoom 邀請的原始時區。": "Please confirm the original time zone of the Zoom invite first.",
    "Zoom 邀請中找不到有效的 Zoom 連結。": "No valid Zoom link was found in the invite.",
    "不支援的會議時區。": "This meeting time zone is not supported.",
    "不能預約已經過去或已開始的時間。": "You cannot book a time that has already passed or started.",
    "這個時段不可預約。": "This time is unavailable.",
    "這個時段剛剛已被預約。": "This time was just booked.",
    "Zoom 連結格式不正確。": "The Zoom link format is invalid.",
    "請提供開始與結束時間。": "Please provide a start and end time.",
    "請填寫姓名。": "Please enter your name.",
    "這個時段與其他預約衝突。": "This time conflicts with another booking.",
    "請先確認 Zoom 邀請內容與可預約時間。": "Please confirm the Zoom invite details and availability first.",
    "已選時段中有時間剛剛被預約，請重新選擇。": "One of the selected times was just booked. Please choose again.",
  };
  return translations[message] || message;
}

function SelectedSlotsSummary({
  copy,
  language,
  slots,
  onRemove,
}: {
  copy: PublicCopy;
  language: Language;
  slots: PublicSlot[];
  onRemove: (slotId: string) => void;
}) {
  if (!slots.length) {
    return (
      <div className="info-strip muted-strip">
        <AlertCircle size={17} />
        <span>{copy.selectedSlotPrompt}</span>
      </div>
    );
  }

  const sortedSlots = [...slots].sort(compareSlotsByStart);

  return (
    <div className="preview-card selected-summary">
      <div className="selected-summary-head">
        <span>{copy.selectedSlots}</span>
        <strong>{copy.selectedCount(slots.length)}</strong>
      </div>
      <div className="selected-slots-list">
        {sortedSlots.map((slot) => (
          <div className="selected-slot-row" key={slot.id}>
            <div>
              <strong>
                {weekdayLabels[language][ymdToWeekday(slot.dateKey)]}{language === "zh" ? "，" : ", "}
                {formatDateKeyShort(slot.dateKey, language)}
              </strong>
              <span>{formatEtTimeRange(slot.startAtUtc, slot.endAtUtc, language)}</span>
            </div>
            <button className="icon-button" title={copy.removeSlotTitle} type="button" onClick={() => onRemove(slot.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingFields(props: {
  bookingTitleInputRef?: RefObject<HTMLInputElement | null>;
  bookerName: string;
  bookingTitle: string;
  copy: PublicCopy;
  zoomJoinUrl: string;
  notes: string;
  setBookerName: (value: string) => void;
  setBookingTitle: (value: string) => void;
  setZoomJoinUrl: (value: string) => void;
  setNotes: (value: string) => void;
}) {
  return (
    <>
      <label className="field">
        <span>{props.copy.name}</span>
        <div className="input-with-icon">
          <User size={16} />
          <input autoComplete="name" value={props.bookerName} onChange={(event) => props.setBookerName(event.target.value)} />
        </div>
      </label>
      <label className="field">
        <span>{props.copy.topic}</span>
        <div className="input-with-icon">
          <FileText size={16} />
          <input
            placeholder={props.copy.topicPlaceholder}
            ref={props.bookingTitleInputRef}
            value={props.bookingTitle}
            onChange={(event) => props.setBookingTitle(event.target.value)}
          />
        </div>
      </label>
      <label className="field">
        <span>{props.copy.zoomLink}</span>
        <div className="input-with-icon">
          <Link size={16} />
          <input
            inputMode="url"
            placeholder="https://...zoom.us/j/..."
            value={props.zoomJoinUrl}
            onChange={(event) => props.setZoomJoinUrl(event.target.value)}
          />
        </div>
      </label>
      <label className="field">
        <span>{props.copy.notes}</span>
        <input placeholder={props.copy.notesPlaceholder} value={props.notes} onChange={(event) => props.setNotes(event.target.value)} />
      </label>
    </>
  );
}

function AttachmentField(props: {
  attachments: AttachmentState[];
  copy: PublicCopy;
  error: string | null;
  inputKey: number;
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <label className="field">
      <span>{props.copy.attachments}</span>
      <div className="file-upload-row">
        <div className="input-with-icon">
          <FileText size={16} />
          <input
            key={props.inputKey}
            multiple
            type="file"
            onChange={(event) => props.onChange(event.target.files)}
          />
        </div>
      </div>
      {props.attachments.length ? (
        <div className="selected-attachments">
          {props.attachments.map((attachment, index) => (
            <div className="selected-attachment-row" key={`${attachment.fileName}-${attachment.sizeBytes}-${index}`}>
              <span>
                {attachment.fileName}（{formatFileSize(attachment.sizeBytes)}）
              </span>
              <button className="icon-button" title={props.copy.removeAttachmentTitle} type="button" onClick={() => props.onRemove(index)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="field-help">{props.copy.attachmentHelp}</p>
      )}
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </label>
  );
}

function ZoomPreview({
  available,
  copy,
  language,
  notes,
  preview,
}: {
  available: boolean | null;
  copy: PublicCopy;
  language: Language;
  notes: string;
  preview: ParsedZoomInvite;
}) {
  const trimmedNotes = notes.trim();
  return (
    <div className="preview-card">
      <div className={`status-line ${available && preview.timeZoneConfirmed ? "success" : "warning"}`}>
        {available && preview.timeZoneConfirmed ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        <strong>{!preview.timeZoneConfirmed ? copy.confirmTimezone : available ? copy.availableToBook : copy.unavailableToBook}</strong>
      </div>
      <ZoomConfidenceSummary copy={copy} preview={preview} />
      <div className="preview-row">
        <span>{copy.invitedBy}</span>
        <strong>{preview.invitedByName || copy.notProvided}</strong>
      </div>
      <div className="preview-row">
        <span>{copy.topic}</span>
        <strong>{preview.title}</strong>
      </div>
      <div className="preview-row">
        <span>{copy.originalTime}</span>
        <strong>{preview.originalTimeText}</strong>
      </div>
      <div className="preview-row">
        <span>{copy.easternTime}</span>
        <strong>{formatEtDateTimeRange(preview.startAtUtc, preview.endAtUtc, language)}</strong>
      </div>
      <div className="preview-row">
        <span>{copy.zoomLink}</span>
        <a href={preview.zoomJoinUrl || "#"} rel="noreferrer" target="_blank">
          {preview.zoomJoinUrl || copy.linkNotFound}
        </a>
      </div>
      <div className="preview-row">
        <span>{copy.meetingId}</span>
        <strong>{preview.meetingId || copy.noValue}</strong>
      </div>
      <div className="preview-row">
        <span>{copy.passcode}</span>
        <strong>{preview.passcode || copy.noValue}</strong>
      </div>
      {trimmedNotes ? (
        <div className="preview-row">
          <span>{copy.notes}</span>
          <strong>{trimmedNotes}</strong>
        </div>
      ) : null}
    </div>
  );
}

function ZoomConfidenceSummary({ copy, preview }: { copy: PublicCopy; preview: ParsedZoomInvite }) {
  const confidence = getLocalizedZoomParseConfidence(preview, copy);
  const missingItems = getZoomParseMissingItems(preview, copy);
  const separator = copy === publicCopy.zh ? "、" : ", ";
  const missingPrefix = copy === publicCopy.zh ? `${copy.parseMissingItems}：` : `${copy.parseMissingItems}: `;
  return (
    <div className={`parse-confidence ${confidence.tone}`}>
      <div>
        <span>{copy.parseConfidence}</span>
        <strong>{confidence.label}</strong>
      </div>
      {missingItems.length ? (
        <p>
          {missingPrefix}
          {missingItems.join(separator)}
        </p>
      ) : null}
    </div>
  );
}

function ZoomConfirmationDialog(props: {
  available: boolean | null;
  copy: PublicCopy;
  language: Language;
  loading: boolean;
  message: BookingMessage | null;
  notes: string;
  preview: ParsedZoomInvite;
  selectedSourceTimeZone: string;
  suggestions: PublicSlot[];
  onCancel: () => void;
  onConfirm: () => void;
  onPickSuggestion: (slot: PublicSlot) => void;
  onSourceTimeZoneChange: (timeZone: string) => void;
}) {
  const requiresTimeZoneSelection = props.preview.timeZoneSource !== "invite";
  const canConfirm = props.available === true && props.preview.timeZoneConfirmed;
  const dialogTitle = !props.preview.timeZoneConfirmed
    ? props.copy.chooseOriginalTimezone
    : canConfirm
      ? props.copy.confirmBookingInfo
      : props.copy.timeUnavailable;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onCancel}>
      <section
        aria-labelledby="zoom-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">{props.copy.zoomBooking}</span>
            <h2 id="zoom-confirmation-title">{dialogTitle}</h2>
          </div>
          <button aria-label={props.copy.closeDialogLabel} className="icon-button" type="button" onClick={props.onCancel}>
            <X size={18} />
          </button>
        </div>

        <ZoomPreview available={props.available} copy={props.copy} language={props.language} notes={props.notes} preview={props.preview} />
        {requiresTimeZoneSelection ? (
          <label className="field timezone-confirmation">
            <span>{props.copy.sourceTimezone}</span>
            <select
              disabled={props.loading}
              value={props.selectedSourceTimeZone}
              onChange={(event) => props.onSourceTimeZoneChange(event.target.value)}
            >
              <option value="">{props.copy.chooseInviteTimezone}</option>
              {ZOOM_TIME_ZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {getZoomTimeZoneLabel(option.value, props.language, option.label)}
                </option>
              ))}
            </select>
            <p className="field-help">{props.copy.timezoneHelp}</p>
          </label>
        ) : null}
        {props.message ? <div className={`message ${props.message.type}`}>{props.message.text}</div> : null}
        {!canConfirm && props.preview.timeZoneConfirmed && props.suggestions.length ? (
          <Suggestions copy={props.copy} language={props.language} slots={props.suggestions} onPick={props.onPickSuggestion} />
        ) : null}

        <div className="dialog-actions">
          <button className="ghost-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            {canConfirm ? props.copy.cancel : props.copy.close}
          </button>
          {canConfirm ? (
            <button className="primary-button" disabled={props.loading} type="button" onClick={props.onConfirm}>
              <Check size={17} />
              {props.copy.confirmAndBook}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MissingZoomConfirmationDialog(props: {
  loading: boolean;
  copy: PublicCopy;
  slotCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onCancel}>
      <section
        aria-labelledby="missing-zoom-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">{props.copy.manualBooking}</span>
            <h2 id="missing-zoom-confirmation-title">{props.copy.missingZoomTitle}</h2>
          </div>
          <button aria-label={props.copy.closeDialogLabel} className="icon-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="preview-card">
          <div className="status-line warning">
            <AlertCircle size={17} />
            <strong>{props.copy.missingZoomWarning}</strong>
          </div>
          <p className="dialog-copy">
            {props.copy.missingZoomCopy(props.slotCount)}
          </p>
        </div>

        <div className="dialog-actions">
          <button className="ghost-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            {props.copy.backToAddLink}
          </button>
          <button className="primary-button" disabled={props.loading} type="button" onClick={props.onConfirm}>
            <Check size={17} />
            {props.copy.submitAnyway}
          </button>
        </div>
      </section>
    </div>
  );
}

function MissingTopicDialog(props: { copy: PublicCopy; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <section
        aria-labelledby="missing-topic-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">{props.copy.manualBooking}</span>
            <h2 id="missing-topic-confirmation-title">{props.copy.missingTopicTitle}</h2>
          </div>
          <button aria-label={props.copy.closeDialogLabel} className="icon-button" type="button" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="preview-card">
          <div className="status-line warning">
            <AlertCircle size={17} />
            <strong>{props.copy.missingTopicWarning}</strong>
          </div>
          <p className="dialog-copy">{props.copy.missingTopicCopy}</p>
        </div>

        <div className="dialog-actions single">
          <button className="primary-button" type="button" onClick={props.onClose}>
            <FileText size={17} />
            {props.copy.backToAddTopic}
          </button>
        </div>
      </section>
    </div>
  );
}

function BookingSuccessDialog(props: {
  copy: PublicCopy;
  language: Language;
  success: BookingSuccessState;
  onAddToCalendar: () => void;
  onClose: () => void;
}) {
  const count = props.success.bookings.length;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onClose}>
      <section
        aria-labelledby="booking-success-title"
        aria-modal="true"
        className="confirmation-dialog success-dialog"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">{props.copy.booking}</span>
            <h2 id="booking-success-title">{props.copy.successTitle}</h2>
          </div>
          <button aria-label={props.copy.closeDialogLabel} className="icon-button" type="button" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="preview-card success-summary-card">
          <div className="status-line success">
            <CheckCircle2 size={17} />
            <strong>{count > 1 ? props.copy.successBatchCopy(count) : props.copy.successCopy}</strong>
          </div>
          <div className="success-booking-list" aria-label={props.copy.bookingDetails}>
            {props.success.bookings.map((booking, index) => (
              <div className="success-booking-row" key={booking.id || `${booking.startAtUtc}-${index}`}>
                <strong>{booking.title}</strong>
                <span>{formatEtDateTimeRange(booking.startAtUtc, booking.endAtUtc, props.language)}</span>
                {booking.zoomJoinUrl ? <a href={booking.zoomJoinUrl} rel="noreferrer" target="_blank">{booking.zoomJoinUrl}</a> : null}
                {booking.notes ? <em>{booking.notes}</em> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={props.onAddToCalendar}>
            <CalendarCheck size={17} />
            {props.copy.addToCalendar}
          </button>
          <button className="primary-button" type="button" onClick={props.onClose}>
            <Check size={17} />
            {props.copy.done}
          </button>
        </div>
      </section>
    </div>
  );
}

function Suggestions(props: { copy: PublicCopy; language: Language; slots: PublicSlot[]; onPick: (slot: PublicSlot) => void }) {
  return (
    <div className="suggestion-box">
      <div className="suggestion-heading">
        <span>{props.copy.alternativeTimes}</span>
        <small>{props.copy.availabilityWindow}</small>
      </div>
      <div className="slot-list">
        {props.slots.slice(0, 4).map((slot) => (
          <button className="slot-button" key={slot.id} type="button" onClick={() => props.onPick(slot)}>
            <Clock size={15} />
            <span>
              {formatDateKeyShort(slot.dateKey, props.language)}
              {props.language === "zh" ? "，" : ", "}
              {formatEtTimeRange(slot.startAtUtc, slot.endAtUtc, props.language)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
