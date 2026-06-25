"use client";

import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
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
import { useEffect, useMemo, useRef, useState } from "react";
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

const availabilityWindow = "週一至週五 晚上 8:00 到凌晨 12:00（美東）；週六、週日 早上 10:00 到下午 1:00、晚上 7:00 到凌晨 12:00（美東）";
const maxWeekOffset = 3;
const maxAttachmentBytes = 5 * 1024 * 1024;
const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function PublicScheduler() {
  const [todayYmd] = useState(() => formatYmd(new Date(), EASTERN_TIME_ZONE));
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<PublicSlot[]>([]);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"calendar" | "zoom">("calendar");
  const [bookerName, setBookerName] = useState("");
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
  const [showMissingZoomConfirm, setShowMissingZoomConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<BookingMessage | null>(null);
  const slotsRequestId = useRef(0);

  const currentWeekStartYmd = useMemo(() => startOfWeekYmd(todayYmd), [todayYmd]);
  const weekRange = useMemo(() => buildWeekRange(currentWeekStartYmd, weekOffset), [currentWeekStartYmd, weekOffset]);
  const todayLabel = useMemo(() => formatDateKeyLong(todayYmd), [todayYmd]);
  const weekLabel = useMemo(() => `${formatDateKeyShort(weekRange.fromYmd)} - ${formatDateKeyShort(weekRange.toYmd)}`, [weekRange]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const dateKey = addDaysToYmd(weekRange.fromYmd, index);
        return {
          dateKey,
          dateLabel: formatDateKeyShort(dateKey),
          isToday: dateKey === todayYmd,
          weekdayLabel: weekdayLabels[ymdToWeekday(dateKey)],
        };
      }),
    [todayYmd, weekRange]
  );

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
        throw new Error(data.error || "無法載入可預約時段。");
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
        setMessage({ type: "error", text: error instanceof Error ? error.message : "無法載入可預約時段。" });
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
    setExpandedDayKey(null);
  }, [weekRange.fromYmd]);

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
  const blockedSlotCount = slots.length - availableSlotCount;
  const selectedSlotIds = useMemo(() => new Set(selectedSlots.map((slot) => slot.id)), [selectedSlots]);

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
        throw new Error(data.error || "無法解析 Zoom 邀請。");
      }
      setPreview(data.preview);
      setPreviewAvailable(Boolean(data.available));
      setSuggestions(data.available ? [] : data.suggestions || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Zoom 解析失敗。" });
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

  async function createBooking(payload: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; suggestions?: PublicSlot[] };
      if (!response.ok) {
        setSuggestions(data.suggestions || []);
        if (payload.source === "zoom") {
          setPreviewAvailable(false);
        }
        throw new Error(data.error || "預約失敗。");
      }
      setMessage({ type: "success", text: "預約已確認，這段時間已保留。" });
      setMode("calendar");
      setSelectedSlots([]);
      setPreview(null);
      setPreviewAvailable(null);
      setSuggestions([]);
      setSelectedSourceTimeZone("");
      setZoomText("");
      setBookerName("");
      setZoomJoinUrl("");
      setNotes("");
      clearAttachments();
      void loadSlots(weekOffset);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "預約失敗。" });
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
      setMessage({ type: "error", text: "請先選擇至少一個可預約時段。" });
      return;
    }
    const blockedSelection = selectedSlots.find((slot) => slot.status === "blocked");
    if (blockedSelection) {
      setMessage({ type: "error", text: "已選時段中有時間剛剛被預約，請重新選擇。" });
      setSelectedSlots((current) => current.filter((slot) => slot.status !== "blocked"));
      return;
    }
    if (!bookerName.trim()) {
      setMessage({ type: "error", text: "請填寫姓名。" });
      return;
    }
    if (!zoomJoinUrl.trim() && !options.allowMissingZoom) {
      setShowMissingZoomConfirm(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    setShowMissingZoomConfirm(false);
    const attachmentPayload = buildAttachmentPayload(attachments);
    const zoomUrl = zoomJoinUrl.trim() || null;
    let createdCount = 0;

    try {
      for (const slot of selectedSlots) {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "manual",
            title: "預約會議",
            startAtUtc: slot.startAtUtc,
            endAtUtc: slot.endAtUtc,
            bookerName,
            zoomJoinUrl: zoomUrl,
            notes,
            ...attachmentPayload,
          }),
        });
        const data = (await response.json()) as { error?: string; suggestions?: PublicSlot[] };
        if (!response.ok) {
          setSuggestions(data.suggestions || []);
          throw new Error(data.error || "預約失敗。");
        }
        createdCount += 1;
      }

      setMessage({
        type: "success",
        text:
          selectedSlots.length > 1
            ? `已確認 ${selectedSlots.length} 個預約，這些時間已保留。`
            : "預約已確認，這段時間已保留。",
      });
      setMode("calendar");
      setSelectedSlots([]);
      setBookerName("");
      setZoomJoinUrl("");
      setNotes("");
      clearAttachments();
      void loadSlots(weekOffset);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "預約失敗。";
      setMessage({
        type: "error",
        text: createdCount ? `已建立 ${createdCount} 個預約，但後續預約失敗：${detail}` : detail,
      });
      void loadSlots(weekOffset);
    } finally {
      setLoading(false);
    }
  }

  function submitZoom() {
    if (!preview || !previewAvailable || !preview.timeZoneConfirmed) {
      setMessage({ type: "error", text: "請先確認 Zoom 邀請內容與可預約時間。" });
      return;
    }
    void createBooking({
      source: "zoom",
      rawInviteText: zoomText,
      sourceTimeZone: selectedSourceTimeZone || undefined,
      ...buildAttachmentPayload(attachments),
    });
  }

  async function handleAttachmentChange(files: FileList | null) {
    setAttachmentError(null);
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) {
      return;
    }
    const oversizedFile = selectedFiles.find((file) => file.size > maxAttachmentBytes);
    if (oversizedFile) {
      setAttachmentError(`${oversizedFile.name} 超過 5MB，請重新選擇。`);
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
      setAttachmentError("附件讀取失敗，請重新上傳。");
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

  const canGoPreviousWeek = weekOffset > 0;
  const canGoNextWeek = weekOffset < maxWeekOffset;

  return (
    <main className="app-shell scheduler-shell">
      <div className="topbar compact">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={22} />
          </div>
          <div>
            <h1>線上預約系統</h1>
            <p>{availabilityWindow}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="window-badge">
            <Clock size={15} />
            60 分鐘，每 30 分鐘可選
          </span>
          <a className="ghost-button" href="/admin">
            管理後台
          </a>
        </div>
      </div>

      <section className="scheduler-layout">
        <section className="surface calendar-surface" aria-labelledby="available-times-heading">
          <div className="surface-header">
            <div>
              <span className="section-kicker">公開可預約時間</span>
              <h2 id="available-times-heading">選擇可預約時段</h2>
              <p className="muted">{availabilityWindow}。預約細節不會公開顯示。</p>
              <p className="today-line">
                今天：<strong>{todayLabel}</strong>
              </p>
            </div>
            <div className="week-actions" aria-label="週切換">
              {canGoPreviousWeek ? (
                <button className="ghost-button compact-button" type="button" onClick={() => setWeekOffset((current) => Math.max(0, current - 1))}>
                  <ChevronLeft size={16} />
                  上一週
                </button>
              ) : null}
              {canGoNextWeek ? (
                <button
                  className="ghost-button compact-button"
                  type="button"
                  onClick={() => setWeekOffset((current) => Math.min(maxWeekOffset, current + 1))}
                >
                  下一週
                  <ChevronRight size={16} />
                </button>
              ) : null}
              <button className="ghost-button compact-button" type="button" onClick={() => void loadSlots(weekOffset)}>
                <RotateCw size={16} />
                重新整理
              </button>
            </div>
          </div>

          <div className="calendar-toolbar" aria-label="可預約時間摘要">
            <div>
              <strong>{weekOffset === 0 ? "本週" : `${weekOffset} 週後`}</strong>
              <span>{weekLabel}</span>
            </div>
            <div>
              <strong>{slotsLoading ? "..." : availableSlotCount}</strong>
              <span>可預約時段</span>
            </div>
            <div>
              <strong>{slotsLoading ? "..." : blockedSlotCount}</strong>
              <span>已預約</span>
            </div>
            <div>
              <strong>美東</strong>
              <span>時區</span>
            </div>
          </div>

          <div className="calendar-grid">
            {weekDays.map((day) => {
              const daySlots = slotsByDate.get(day.dateKey) || [];
              const availableCount = daySlots.filter((slot) => slot.status !== "blocked").length;
              const blockedCount = daySlots.length - availableCount;
              const expanded = expandedDayKey === day.dateKey;
              return (
                <div className={`day-column ${day.isToday ? "today" : ""} ${expanded ? "expanded" : ""}`} key={day.dateKey}>
                  <button
                    aria-expanded={expanded}
                    className="day-head"
                    type="button"
                    onClick={() => setExpandedDayKey((current) => (current === day.dateKey ? null : day.dateKey))}
                  >
                    <div className="day-head-main">
                      <div className="day-head-title">
                        <strong>{day.weekdayLabel}</strong>
                        {day.isToday ? <span className="today-chip">今天</span> : null}
                      </div>
                      <span>{day.dateLabel}</span>
                    </div>
                    <span className="day-slot-summary">
                      {slotsLoading ? "載入中" : daySlots.length ? `${availableCount} 可約${blockedCount ? ` / ${blockedCount} 已約` : ""}` : "無時段"}
                    </span>
                    <ChevronDown className="day-toggle-icon" size={16} />
                  </button>
                  <div className="slot-list">
                    {slotsLoading ? (
                      <div className="no-slots">載入中...</div>
                    ) : daySlots.length ? (
                      daySlots.map((slot) => {
                        const blocked = slot.status === "blocked";
                        const selected = selectedSlotIds.has(slot.id);
                        return (
                        <button
                          aria-pressed={selected}
                          className={`slot-button ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
                          disabled={blocked}
                          key={slot.id}
                          type="button"
                          onClick={() => toggleSlotSelection(slot)}
                        >
                          <Clock size={15} />
                          <span>
                            {formatEtTimeRange(slot.startAtUtc, slot.endAtUtc)}
                            {blocked ? <small>已預約</small> : null}
                          </span>
                        </button>
                        );
                      })
                    ) : (
                      <div className="no-slots">無可預約時段</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="surface booking-surface" aria-labelledby="booking-panel-heading">
          <div className="surface-header slim">
            <div>
              <span className="section-kicker">預約</span>
              <h2 id="booking-panel-heading">確認預約</h2>
            </div>
          </div>

          <div className="segmented-control" role="tablist" aria-label="預約方式">
            <button
              className={`segment-button ${mode === "calendar" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setMode("calendar");
                setMessage(null);
              }}
            >
              <CalendarCheck size={16} />
              選擇時段
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
              貼上 Zoom
            </button>
          </div>

          {mode === "calendar" ? (
            <div className="form-stack">
              <SelectedSlotsSummary slots={selectedSlots} onRemove={removeSelectedSlot} />
              <BookingFields
                bookerName={bookerName}
                notes={notes}
                zoomJoinUrl={zoomJoinUrl}
                setBookerName={setBookerName}
                setNotes={setNotes}
                setZoomJoinUrl={setZoomJoinUrl}
              />
              <AttachmentField
                attachments={attachments}
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
                {selectedSlots.length > 1 ? `確認 ${selectedSlots.length} 個時段` : "確認手動預約"}
              </button>
            </div>
          ) : (
            <div className="form-stack">
              <label className="field">
                <span>Zoom 邀請內容</span>
                <textarea
                  placeholder="貼上完整 Zoom 邀請內容，系統會自動抓取會議時間與連結。"
                  value={zoomText}
                  onChange={(event) => setZoomText(event.target.value)}
                />
              </label>
              <AttachmentField
                attachments={attachments}
                error={attachmentError}
                inputKey={attachmentInputKey}
                onChange={(files) => void handleAttachmentChange(files)}
                onRemove={removeAttachment}
              />
              <button className="primary-button" disabled={loading || !zoomText.trim()} type="button" onClick={() => void openZoomConfirmation()}>
                <Send size={17} />
                提交 Zoom 預約
              </button>
            </div>
          )}

          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </aside>

        {preview ? (
          <ZoomConfirmationDialog
            available={previewAvailable}
            loading={loading}
            message={message}
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
            slotCount={selectedSlots.length}
            onCancel={() => setShowMissingZoomConfirm(false)}
            onConfirm={() => void submitManualBookings({ allowMissingZoom: true })}
          />
        ) : null}
      </section>
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

function startOfWeekYmd(ymd: string): string {
  return addDaysToYmd(ymd, -((ymdToWeekday(ymd) + 6) % 7));
}

function buildWeekRange(currentWeekStartYmd: string, weekOffset: number): { fromYmd: string; toYmd: string } {
  const fromYmd = addDaysToYmd(currentWeekStartYmd, weekOffset * 7);
  return { fromYmd, toYmd: addDaysToYmd(fromYmd, 6) };
}

function formatDateKeyShort(ymd: string): string {
  const [, month, day] = ymd.split("-").map(Number);
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

function formatEtTime(iso: string): string {
  const parts = getEtParts(iso);
  const period = parts.hour < 6 ? "凌晨" : parts.hour < 12 ? "早上" : parts.hour < 18 ? "下午" : "晚上";
  const hour = parts.hour % 12 || 12;
  return `${period} ${hour}:${String(parts.minute).padStart(2, "0")}`;
}

function formatEtTimeRange(startIso: string, endIso: string): string {
  return `${formatEtTime(startIso)} - ${formatEtTime(endIso)}（美東）`;
}

function formatEtDateTimeRange(startIso: string, endIso: string): string {
  const start = getEtParts(startIso);
  const end = getEtParts(endIso);
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  const startDate = `${start.year}年${start.month}月${start.day}日`;
  if (sameDay) {
    return `${startDate} ${formatEtTimeRange(startIso, endIso)}`;
  }
  return `${startDate} ${formatEtTime(startIso)} - ${end.year}年${end.month}月${end.day}日 ${formatEtTime(endIso)}（美東）`;
}

function formatDateKeyLong(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function compareSlotsByStart(left: PublicSlot, right: PublicSlot): number {
  return left.startAtUtc.localeCompare(right.startAtUtc);
}

function SelectedSlotsSummary({ slots, onRemove }: { slots: PublicSlot[]; onRemove: (slotId: string) => void }) {
  if (!slots.length) {
    return (
      <div className="info-strip muted-strip">
        <AlertCircle size={17} />
        <span>請先從行事曆選擇一個或多個可預約時段。</span>
      </div>
    );
  }

  const sortedSlots = [...slots].sort(compareSlotsByStart);

  return (
    <div className="preview-card selected-summary">
      <div className="selected-summary-head">
        <span>已選時段</span>
        <strong>{slots.length} 個</strong>
      </div>
      <div className="selected-slots-list">
        {sortedSlots.map((slot) => (
          <div className="selected-slot-row" key={slot.id}>
            <div>
              <strong>{slot.weekdayLabel}，{slot.dateLabel}</strong>
              <span>{formatEtTimeRange(slot.startAtUtc, slot.endAtUtc)}</span>
            </div>
            <button className="icon-button" title="移除時段" type="button" onClick={() => onRemove(slot.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingFields(props: {
  bookerName: string;
  zoomJoinUrl: string;
  notes: string;
  setBookerName: (value: string) => void;
  setZoomJoinUrl: (value: string) => void;
  setNotes: (value: string) => void;
}) {
  return (
    <>
      <label className="field">
        <span>姓名</span>
        <div className="input-with-icon">
          <User size={16} />
          <input autoComplete="name" value={props.bookerName} onChange={(event) => props.setBookerName(event.target.value)} />
        </div>
      </label>
      <label className="field">
        <span>Zoom 連結</span>
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
        <span>備註</span>
        <input placeholder="可選填會議背景或補充資訊" value={props.notes} onChange={(event) => props.setNotes(event.target.value)} />
      </label>
    </>
  );
}

function AttachmentField(props: {
  attachments: AttachmentState[];
  error: string | null;
  inputKey: number;
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <label className="field">
      <span>附件</span>
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
              <button className="icon-button" title="移除附件" type="button" onClick={() => props.onRemove(index)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="field-help">可選填，最多 5MB。</p>
      )}
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </label>
  );
}

function ZoomPreview({ available, preview }: { available: boolean | null; preview: ParsedZoomInvite }) {
  return (
    <div className="preview-card">
      <div className={`status-line ${available && preview.timeZoneConfirmed ? "success" : "warning"}`}>
        {available && preview.timeZoneConfirmed ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        <strong>{!preview.timeZoneConfirmed ? "請先確認原始時區" : available ? "可預約" : "此時段不可預約"}</strong>
      </div>
      <div className="preview-row">
        <span>邀請人</span>
        <strong>{preview.invitedByName || "未提供"}</strong>
      </div>
      <div className="preview-row">
        <span>主題</span>
        <strong>{preview.title}</strong>
      </div>
      <div className="preview-row">
        <span>原始時間</span>
        <strong>{preview.originalTimeText}</strong>
      </div>
      <div className="preview-row">
        <span>美東時間</span>
        <strong>{formatEtDateTimeRange(preview.startAtUtc, preview.endAtUtc)}</strong>
      </div>
      <div className="preview-row">
        <span>Zoom 連結</span>
        <a href={preview.zoomJoinUrl || "#"} rel="noreferrer" target="_blank">
          {preview.zoomJoinUrl || "未找到連結"}
        </a>
      </div>
      <div className="preview-row">
        <span>會議號</span>
        <strong>{preview.meetingId || "無"}</strong>
      </div>
      <div className="preview-row">
        <span>密碼</span>
        <strong>{preview.passcode || "無"}</strong>
      </div>
    </div>
  );
}

function ZoomConfirmationDialog(props: {
  available: boolean | null;
  loading: boolean;
  message: BookingMessage | null;
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
    ? "請確認會議原始時區"
    : canConfirm
      ? "確認預約資訊"
      : "這個時間目前無法預約";
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
            <span className="section-kicker">Zoom 預約</span>
            <h2 id="zoom-confirmation-title">{dialogTitle}</h2>
          </div>
          <button aria-label="關閉確認視窗" className="icon-button" type="button" onClick={props.onCancel}>
            <X size={18} />
          </button>
        </div>

        <ZoomPreview available={props.available} preview={props.preview} />
        {requiresTimeZoneSelection ? (
          <label className="field timezone-confirmation">
            <span>會議原始時區</span>
            <select
              disabled={props.loading}
              value={props.selectedSourceTimeZone}
              onChange={(event) => props.onSourceTimeZoneChange(event.target.value)}
            >
              <option value="">請選擇邀請使用的時區</option>
              {ZOOM_TIME_ZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="field-help">選擇後系統會重新計算美東時間與可預約狀態。</p>
          </label>
        ) : null}
        {props.message ? <div className={`message ${props.message.type}`}>{props.message.text}</div> : null}
        {!canConfirm && props.preview.timeZoneConfirmed && props.suggestions.length ? <Suggestions slots={props.suggestions} onPick={props.onPickSuggestion} /> : null}

        <div className="dialog-actions">
          <button className="ghost-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            {canConfirm ? "取消" : "關閉"}
          </button>
          {canConfirm ? (
            <button className="primary-button" disabled={props.loading} type="button" onClick={props.onConfirm}>
              <Check size={17} />
              確認並預約
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MissingZoomConfirmationDialog(props: {
  loading: boolean;
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
            <span className="section-kicker">手動預約</span>
            <h2 id="missing-zoom-confirmation-title">未提供 Zoom 連結</h2>
          </div>
          <button aria-label="關閉確認視窗" className="icon-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="preview-card">
          <div className="status-line warning">
            <AlertCircle size={17} />
            <strong>這次預約沒有 Zoom 連結。</strong>
          </div>
          <p className="dialog-copy">
            系統仍會建立 {props.slotCount} 個預約並封鎖時段，但管理員之後可能需要補上會議連結。
          </p>
        </div>

        <div className="dialog-actions">
          <button className="ghost-button" disabled={props.loading} type="button" onClick={props.onCancel}>
            返回補連結
          </button>
          <button className="primary-button" disabled={props.loading} type="button" onClick={props.onConfirm}>
            <Check size={17} />
            仍然送出
          </button>
        </div>
      </section>
    </div>
  );
}

function Suggestions(props: { slots: PublicSlot[]; onPick: (slot: PublicSlot) => void }) {
  return (
    <div className="suggestion-box">
      <div className="suggestion-heading">
        <span>可改選時段</span>
        <small>{availabilityWindow}</small>
      </div>
      <div className="slot-list">
        {props.slots.slice(0, 4).map((slot) => (
          <button className="slot-button" key={slot.id} type="button" onClick={() => props.onPick(slot)}>
            <Clock size={15} />
            <span>{slot.dateLabel}，{formatEtTimeRange(slot.startAtUtc, slot.endAtUtc)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
