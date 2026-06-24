"use client";

import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
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
import type { ParsedZoomInvite, PublicSlot } from "@/lib/types";

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

type PdfAttachmentState = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
};

const availabilityWindow = "週一至週五 晚上 8:00 到凌晨 12:00（美東）；週六、週日 早上 10:00 到下午 1:00、晚上 7:00 到凌晨 12:00（美東）";
const maxWeekOffset = 3;
const maxPdfBytes = 5 * 1024 * 1024;
const weekdayLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function PublicScheduler() {
  const [todayYmd] = useState(() => formatYmd(new Date(), EASTERN_TIME_ZONE));
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [mode, setMode] = useState<"calendar" | "zoom">("calendar");
  const [bookerName, setBookerName] = useState("");
  const [zoomJoinUrl, setZoomJoinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfAttachment, setPdfAttachment] = useState<PdfAttachmentState | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfInputKey, setPdfInputKey] = useState(0);
  const [zoomText, setZoomText] = useState("");
  const [preview, setPreview] = useState<ParsedZoomInvite | null>(null);
  const [suggestions, setSuggestions] = useState<PublicSlot[]>([]);
  const [previewAvailable, setPreviewAvailable] = useState<boolean | null>(null);
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
      setSelectedSlot(null);
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
      setSelectedSlot((current) => nextSlots.find((slot) => slot.id === current?.id && slot.status !== "blocked") || null);
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

  async function parseZoomInvite() {
    setLoading(true);
    setMessage(null);
    setPreview(null);
    setSuggestions([]);
    setPreviewAvailable(null);
    try {
      const response = await fetch("/api/zoom-invites/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: zoomText }),
      });
      const data = (await response.json()) as ParseResponse;
      if (!response.ok || !data.preview) {
        throw new Error(data.error || "無法解析 Zoom 邀請。");
      }
      setPreview(data.preview);
      setPreviewAvailable(Boolean(data.available));
      setSuggestions(data.available ? [] : data.suggestions || []);
      if (!data.available) {
        setMessage({ type: "warning", text: "這個 Zoom 時間不在可預約時段內，請改選下方可用時間。" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Zoom 解析失敗。" });
    } finally {
      setLoading(false);
    }
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
        throw new Error(data.error || "預約失敗。");
      }
      setMessage({ type: "success", text: "預約已確認，這段時間已保留。" });
      setMode("calendar");
      setSelectedSlot(null);
      setPreview(null);
      setPreviewAvailable(null);
      setSuggestions([]);
      setZoomText("");
      setBookerName("");
      setZoomJoinUrl("");
      setNotes("");
      clearPdfAttachment();
      void loadSlots(weekOffset);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "預約失敗。" });
    } finally {
      setLoading(false);
    }
  }

  function submitManual() {
    if (!selectedSlot) {
      setMessage({ type: "error", text: "請先選擇一個可預約時段。" });
      return;
    }
    if (selectedSlot.status === "blocked") {
      setMessage({ type: "error", text: "這個時段已被預約，請改選其他時間。" });
      setSelectedSlot(null);
      return;
    }
    if (!bookerName.trim() || !zoomJoinUrl.trim()) {
      setMessage({ type: "error", text: "手動預約需要填寫姓名與 Zoom 連結。" });
      return;
    }
    void createBooking({
      source: "manual",
      title: "預約會議",
      startAtUtc: selectedSlot.startAtUtc,
      endAtUtc: selectedSlot.endAtUtc,
      bookerName,
      zoomJoinUrl,
      notes,
      ...buildPdfPayload(pdfAttachment),
    });
  }

  function submitZoom() {
    if (!preview || !previewAvailable) {
      setMessage({ type: "error", text: "請先解析 Zoom 邀請，並確認時間可預約。" });
      return;
    }
    void createBooking({
      source: "zoom",
      rawInviteText: zoomText,
      ...buildPdfPayload(pdfAttachment),
    });
  }

  async function handlePdfChange(file: File | undefined) {
    setPdfError(null);
    setPdfAttachment(null);
    if (!file) {
      return;
    }
    if ((file.type && file.type !== "application/pdf") || !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("附件只支援 PDF 檔案。");
      setPdfInputKey((current) => current + 1);
      return;
    }
    if (file.size > maxPdfBytes) {
      setPdfError("PDF 附件不可超過 5MB。");
      setPdfInputKey((current) => current + 1);
      return;
    }

    try {
      const dataBase64 = await readFileAsBase64(file);
      setPdfAttachment({
        fileName: file.name,
        mimeType: "application/pdf",
        dataBase64,
        sizeBytes: file.size,
      });
    } catch {
      setPdfError("PDF 讀取失敗，請重新上傳。");
      setPdfInputKey((current) => current + 1);
    }
  }

  function clearPdfAttachment() {
    setPdfAttachment(null);
    setPdfError(null);
    setPdfInputKey((current) => current + 1);
  }

  function pickSuggestion(slot: PublicSlot) {
    setMode("calendar");
    setSelectedSlot(slot);
    setMessage(null);
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
            60 分鐘，15 分鐘間隔
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
              return (
                <div className={`day-column ${day.isToday ? "today" : ""}`} key={day.dateKey}>
                  <div className="day-head">
                    <div className="day-head-title">
                      <strong>{day.weekdayLabel}</strong>
                      {day.isToday ? <span className="today-chip">今天</span> : null}
                    </div>
                    <span>{day.dateLabel}</span>
                  </div>
                  <div className="slot-list">
                    {slotsLoading ? (
                      <div className="no-slots">載入中...</div>
                    ) : daySlots.length ? (
                      daySlots.map((slot) => {
                        const blocked = slot.status === "blocked";
                        return (
                        <button
                          className={`slot-button ${selectedSlot?.id === slot.id ? "selected" : ""} ${blocked ? "blocked" : ""}`}
                          disabled={blocked}
                          key={slot.id}
                          type="button"
                          onClick={() => {
                            if (blocked) {
                              return;
                            }
                            setMode("calendar");
                            setSelectedSlot(slot);
                            setMessage(null);
                          }}
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
              <SelectedSlotSummary slot={selectedSlot} />
              <BookingFields
                bookerName={bookerName}
                notes={notes}
                zoomJoinUrl={zoomJoinUrl}
                setBookerName={setBookerName}
                setNotes={setNotes}
                setZoomJoinUrl={setZoomJoinUrl}
              />
              <PdfAttachmentField
                attachment={pdfAttachment}
                error={pdfError}
                inputKey={pdfInputKey}
                onChange={(file) => void handlePdfChange(file)}
                onRemove={clearPdfAttachment}
              />
              <button
                className="primary-button"
                disabled={loading || !selectedSlot || !bookerName.trim() || !zoomJoinUrl.trim()}
                type="button"
                onClick={submitManual}
              >
                <Check size={17} />
                確認手動預約
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
              <button className="ghost-button" disabled={loading || !zoomText.trim()} type="button" onClick={() => void parseZoomInvite()}>
                <Link size={17} />
                解析邀請
              </button>
              {preview ? <ZoomPreview available={previewAvailable} preview={preview} /> : null}
              {!previewAvailable && suggestions.length ? <Suggestions slots={suggestions} onPick={pickSuggestion} /> : null}
              <PdfAttachmentField
                attachment={pdfAttachment}
                error={pdfError}
                inputKey={pdfInputKey}
                onChange={(file) => void handlePdfChange(file)}
                onRemove={clearPdfAttachment}
              />
              <button className="primary-button" disabled={loading || !preview || !previewAvailable} type="button" onClick={submitZoom}>
                <Send size={17} />
                確認 Zoom 預約
              </button>
            </div>
          )}

          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </aside>
      </section>
    </main>
  );
}

function buildPdfPayload(attachment: PdfAttachmentState | null): Record<string, string> {
  if (!attachment) {
    return {};
  }
  return {
    attachmentFileName: attachment.fileName,
    attachmentMimeType: attachment.mimeType,
    attachmentDataBase64: attachment.dataBase64,
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() || "" : result);
    };
    reader.onerror = () => reject(new Error("PDF_READ_FAILED"));
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

function SelectedSlotSummary({ slot }: { slot: PublicSlot | null }) {
  if (!slot) {
    return (
      <div className="info-strip muted-strip">
        <AlertCircle size={17} />
        <span>請先從行事曆選擇一個可預約時段。</span>
      </div>
    );
  }

  return (
    <div className="preview-card selected-summary">
      <div className="preview-row">
        <span>日期</span>
        <strong>{slot.weekdayLabel}, {slot.dateLabel}</strong>
      </div>
      <div className="preview-row">
        <span>時間</span>
        <strong>{formatEtTimeRange(slot.startAtUtc, slot.endAtUtc)}</strong>
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

function PdfAttachmentField(props: {
  attachment: PdfAttachmentState | null;
  error: string | null;
  inputKey: number;
  onChange: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <label className="field">
      <span>PDF 附件</span>
      <div className="file-upload-row">
        <div className="input-with-icon">
          <FileText size={16} />
          <input
            accept="application/pdf,.pdf"
            key={props.inputKey}
            type="file"
            onChange={(event) => props.onChange(event.target.files?.[0])}
          />
        </div>
        {props.attachment ? (
          <button className="icon-button" title="移除附件" type="button" onClick={props.onRemove}>
            <X size={16} />
          </button>
        ) : null}
      </div>
      {props.attachment ? (
        <p className="field-help">
          已選擇 {props.attachment.fileName}（{formatFileSize(props.attachment.sizeBytes)}）
        </p>
      ) : (
        <p className="field-help">可選填，僅支援 PDF，最多 5MB。</p>
      )}
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </label>
  );
}

function ZoomPreview({ available, preview }: { available: boolean | null; preview: ParsedZoomInvite }) {
  return (
    <div className="preview-card">
      <div className={`status-line ${available ? "success" : "warning"}`}>
        {available ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        <strong>{available ? "可預約" : "此時段不可預約"}</strong>
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
