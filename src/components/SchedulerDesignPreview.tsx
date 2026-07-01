"use client";

import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  FileText,
  Link,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type VariantId = "calendly" | "bottomSheet" | "zoomFirst";

type PreviewSlot = {
  id: string;
  time: string;
  status?: "available" | "blocked";
};

type PreviewDay = {
  id: string;
  weekday: string;
  date: string;
  fullDate: string;
  isToday?: boolean;
  slots: PreviewSlot[];
};

const previewDays: PreviewDay[] = [
  {
    id: "mon",
    weekday: "週一",
    date: "6/15",
    fullDate: "2026年6月15日",
    slots: [
      { id: "mon-2000", time: "晚上 8:00 - 9:00" },
      { id: "mon-2030", time: "晚上 8:30 - 9:30" },
      { id: "mon-2100", time: "晚上 9:00 - 10:00" },
    ],
  },
  {
    id: "tue",
    weekday: "週二",
    date: "6/16",
    fullDate: "2026年6月16日",
    slots: [
      { id: "tue-2000", time: "晚上 8:00 - 9:00" },
      { id: "tue-2100", time: "晚上 9:00 - 10:00", status: "blocked" },
      { id: "tue-2200", time: "晚上 10:00 - 11:00" },
    ],
  },
  {
    id: "wed",
    weekday: "週三",
    date: "6/17",
    fullDate: "2026年6月17日",
    isToday: true,
    slots: [
      { id: "wed-2000", time: "晚上 8:00 - 9:00" },
      { id: "wed-2030", time: "晚上 8:30 - 9:30" },
      { id: "wed-2130", time: "晚上 9:30 - 10:30" },
      { id: "wed-2215", time: "晚上 10:15 - 11:15", status: "blocked" },
    ],
  },
  {
    id: "thu",
    weekday: "週四",
    date: "6/18",
    fullDate: "2026年6月18日",
    slots: [
      { id: "thu-2000", time: "晚上 8:00 - 9:00" },
      { id: "thu-2030", time: "晚上 8:30 - 9:30" },
      { id: "thu-2230", time: "晚上 10:30 - 11:30" },
    ],
  },
  {
    id: "fri",
    weekday: "週五",
    date: "6/19",
    fullDate: "2026年6月19日",
    slots: [
      { id: "fri-2030", time: "晚上 8:30 - 9:30" },
      { id: "fri-2130", time: "晚上 9:30 - 10:30" },
      { id: "fri-2300", time: "晚上 11:00 - 凌晨 12:00" },
    ],
  },
  {
    id: "sat",
    weekday: "週六",
    date: "6/20",
    fullDate: "2026年6月20日",
    slots: [
      { id: "sat-1000", time: "早上 10:00 - 11:00" },
      { id: "sat-1130", time: "早上 11:30 - 下午 12:30" },
      { id: "sat-1900", time: "晚上 7:00 - 8:00" },
    ],
  },
  {
    id: "sun",
    weekday: "週日",
    date: "6/21",
    fullDate: "2026年6月21日",
    slots: [
      { id: "sun-1030", time: "早上 10:30 - 11:30" },
      { id: "sun-1200", time: "下午 12:00 - 1:00" },
      { id: "sun-2100", time: "晚上 9:00 - 10:00" },
    ],
  },
];

const variants: Record<VariantId, { label: string; shortLabel: string; description: string }> = {
  calendly: {
    label: "版本 A：日期優先",
    shortLabel: "A 日期優先",
    description: "像 Calendly：先選日期，再看那天的可約時段，管理入口放到頁尾。",
  },
  bottomSheet: {
    label: "版本 B：手機底部確認",
    shortLabel: "B 底部確認",
    description: "手機優先：每天折疊，選完多個時段後用底部操作列進入確認。",
  },
  zoomFirst: {
    label: "版本 C：Zoom 匯入優先",
    shortLabel: "C Zoom 優先",
    description: "適合常貼邀請：上方先貼 Zoom，確認後仍可用行事曆補選時間。",
  },
};

export function SchedulerDesignPreview() {
  const [variant, setVariant] = useState<VariantId>("calendly");
  const [activeDayId, setActiveDayId] = useState("wed");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(["wed-2030"]);

  const activeDay = previewDays.find((day) => day.id === activeDayId) || previewDays[2];
  const selectedSlots = useMemo(
    () =>
      selectedSlotIds
        .map((slotId) => {
          const day = previewDays.find((candidate) => candidate.slots.some((slot) => slot.id === slotId));
          const slot = day?.slots.find((candidate) => candidate.id === slotId);
          return day && slot ? { ...slot, day } : null;
        })
        .filter((slot): slot is PreviewSlot & { day: PreviewDay } => Boolean(slot)),
    [selectedSlotIds]
  );

  function toggleSlot(slot: PreviewSlot) {
    if (slot.status === "blocked") {
      return;
    }
    setSelectedSlotIds((current) => (current.includes(slot.id) ? current.filter((id) => id !== slot.id) : [...current, slot.id]));
  }

  return (
    <main className="design-preview-shell">
      <header className="design-preview-topbar">
        <a className="ghost-button compact-button" href="/">
          <ChevronLeft size={16} />
          回正式首頁
        </a>
        <div className="design-preview-title">
          <span className="section-kicker">Public RWD concepts</span>
          <h1>三版手機預約介面</h1>
          <p>都用同一組可約時間，重點比較手機上的節奏、資訊密度、管理員入口位置。</p>
        </div>
      </header>

      <section className="variant-selector" aria-label="選擇預覽版本">
        {(Object.keys(variants) as VariantId[]).map((id) => (
          <button className={variant === id ? "active" : ""} key={id} type="button" onClick={() => setVariant(id)}>
            <strong>{variants[id].shortLabel}</strong>
            <span>{variants[id].description}</span>
          </button>
        ))}
      </section>

      <section className="design-screen" aria-label={variants[variant].label}>
        {variant === "calendly" ? (
          <CalendlyLikePreview
            activeDay={activeDay}
            activeDayId={activeDayId}
            selectedSlotIds={selectedSlotIds}
            selectedSlots={selectedSlots}
            setActiveDayId={setActiveDayId}
            toggleSlot={toggleSlot}
          />
        ) : null}

        {variant === "bottomSheet" ? (
          <BottomSheetPreview
            activeDayId={activeDayId}
            selectedSlotIds={selectedSlotIds}
            selectedSlots={selectedSlots}
            setActiveDayId={setActiveDayId}
            toggleSlot={toggleSlot}
          />
        ) : null}

        {variant === "zoomFirst" ? (
          <ZoomFirstPreview
            activeDay={activeDay}
            activeDayId={activeDayId}
            selectedSlotIds={selectedSlotIds}
            selectedSlots={selectedSlots}
            setActiveDayId={setActiveDayId}
            toggleSlot={toggleSlot}
          />
        ) : null}
      </section>

      <footer className="design-preview-footer">
        <span>正式版可把你選中的方向套回首頁。</span>
        <a href="/admin">管理員入口</a>
      </footer>
    </main>
  );
}

function PreviewBrand() {
  return (
    <div className="preview-brand">
      <span className="brand-mark preview-brand-mark">
        <img alt="" src="/icons/app-icon-fashion-192.png" />
      </span>
      <div>
        <h2>線上預約系統</h2>
        <p>美東時間 · 每次會議 60 分鐘</p>
      </div>
    </div>
  );
}

function PreviewHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`preview-app-header ${compact ? "compact-preview-header" : ""}`}>
      <PreviewBrand />
      <div className="preview-header-actions">
        <span className="window-badge">
          <Clock size={15} />
          每 30 分鐘可選
        </span>
        <div className="language-toggle">
          <button className="active" type="button">
            中文
          </button>
          <button type="button">EN</button>
        </div>
      </div>
    </header>
  );
}

function CalendlyLikePreview(props: {
  activeDay: PreviewDay;
  activeDayId: string;
  selectedSlotIds: string[];
  selectedSlots: Array<PreviewSlot & { day: PreviewDay }>;
  setActiveDayId: (dayId: string) => void;
  toggleSlot: (slot: PreviewSlot) => void;
}) {
  return (
    <div className="concept concept-calendly">
      <PreviewHeader />
      <div className="preview-week-bar">
        <button className="ghost-button compact-button" type="button">
          <ChevronLeft size={16} />
          上一週
        </button>
        <div>
          <strong>2026年6月15日 - 6月21日</strong>
          <span>今天：2026年6月17日</span>
        </div>
        <button className="ghost-button compact-button" type="button">
          下一週
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendly-layout">
        <nav className="date-rail" aria-label="選擇日期">
          {previewDays.map((day) => (
            <button
              className={`${props.activeDayId === day.id ? "active" : ""} ${day.isToday ? "today" : ""}`}
              key={day.id}
              type="button"
              onClick={() => props.setActiveDayId(day.id)}
            >
              <span>{day.weekday}</span>
              <strong>{day.date}</strong>
              <small>{day.slots.filter((slot) => slot.status !== "blocked").length} 個可約</small>
            </button>
          ))}
        </nav>

        <section className="slot-focus-panel">
          <div className="focus-panel-head">
            <div>
              <span className="section-kicker">{props.activeDay.fullDate}</span>
              <h3>{props.activeDay.weekday}可預約時段</h3>
            </div>
            <span className="pill">美東</span>
          </div>
          <div className="focus-slot-grid">
            {props.activeDay.slots.map((slot) => (
              <SlotPreviewButton key={slot.id} selected={props.selectedSlotIds.includes(slot.id)} slot={slot} onClick={() => props.toggleSlot(slot)} />
            ))}
          </div>
        </section>

        <aside className="preview-booking-panel">
          <span className="section-kicker">Booking</span>
          <h3>確認預約</h3>
          <SelectedPreviewSummary selectedSlots={props.selectedSlots} />
          <label className="field">
            <span>姓名</span>
            <input defaultValue="Jason Ko" />
          </label>
          <label className="field">
            <span>Zoom 連結</span>
            <input placeholder="https://...zoom.us/j/..." />
          </label>
          <button className="primary-button" type="button">
            <Check size={17} />
            確認預約
          </button>
        </aside>
      </div>
    </div>
  );
}

function BottomSheetPreview(props: {
  activeDayId: string;
  selectedSlotIds: string[];
  selectedSlots: Array<PreviewSlot & { day: PreviewDay }>;
  setActiveDayId: (dayId: string) => void;
  toggleSlot: (slot: PreviewSlot) => void;
}) {
  return (
    <div className="concept concept-bottom-sheet">
      <PreviewHeader compact />
      <div className="mobile-hero-strip">
        <div>
          <span className="section-kicker">選擇時間</span>
          <h3>先選一個或多個時段</h3>
          <p>其他人的預約只會顯示為已預約，不顯示姓名或會議內容。</p>
        </div>
        <button className="ghost-button compact-button" type="button">
          <Link size={16} />
          貼 Zoom
        </button>
      </div>

      <div className="accordion-week">
        {previewDays.map((day) => {
          const expanded = props.activeDayId === day.id;
          const availableCount = day.slots.filter((slot) => slot.status !== "blocked").length;
          return (
            <section className={`accordion-day ${expanded ? "expanded" : ""}`} key={day.id}>
              <button className="accordion-day-head" type="button" onClick={() => props.setActiveDayId(day.id)}>
                <div>
                  <strong>
                    {day.weekday}
                    {day.isToday ? <span>今天</span> : null}
                  </strong>
                  <small>{day.fullDate}</small>
                </div>
                <div>
                  <em>{availableCount} 個可約</em>
                  <ChevronDown size={16} />
                </div>
              </button>
              {expanded ? (
                <div className="accordion-slot-grid">
                  {day.slots.map((slot) => (
                    <SlotPreviewButton key={slot.id} selected={props.selectedSlotIds.includes(slot.id)} slot={slot} onClick={() => props.toggleSlot(slot)} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="preview-bottom-action">
        <div>
          <strong>{props.selectedSlots.length ? `已選 ${props.selectedSlots.length} 個時段` : "尚未選擇時段"}</strong>
          <span>{props.selectedSlots[0] ? `${props.selectedSlots[0].day.weekday} ${props.selectedSlots[0].time}` : "可一次選多個，再一起確認"}</span>
        </div>
        <button className="primary-button" type="button">
          繼續
        </button>
      </div>
    </div>
  );
}

function ZoomFirstPreview(props: {
  activeDay: PreviewDay;
  activeDayId: string;
  selectedSlotIds: string[];
  selectedSlots: Array<PreviewSlot & { day: PreviewDay }>;
  setActiveDayId: (dayId: string) => void;
  toggleSlot: (slot: PreviewSlot) => void;
}) {
  return (
    <div className="concept concept-zoom-first">
      <PreviewHeader compact />
      <div className="zoom-first-layout">
        <section className="zoom-import-panel">
          <div className="focus-panel-head">
            <div>
              <span className="section-kicker">Zoom invite</span>
              <h3>貼上邀請後直接確認</h3>
            </div>
            <span className="pill">
              <Sparkles size={14} />
              自動解析
            </span>
          </div>
          <textarea
            defaultValue={`主題: Oscar - Jason - system design\n時間: 2026年6月17日 10:15 下午 東部時間\n加入Zoom會議\nhttps://drillinsight.zoom.us/j/82151357096`}
          />
          <div className="parsed-preview">
            <div className="status-line success">
              <ShieldCheck size={17} />
              <strong>可預約，確認後會封鎖 1 小時</strong>
            </div>
            <dl>
              <div>
                <dt>主題</dt>
                <dd>Oscar - Jason - system design</dd>
              </div>
              <div>
                <dt>美東時間</dt>
                <dd>2026年6月17日 晚上 10:15 - 11:15</dd>
              </div>
              <div>
                <dt>Zoom</dt>
                <dd>drillinsight.zoom.us/j/82151357096</dd>
              </div>
            </dl>
          </div>
          <button className="primary-button" type="button">
            <Send size={17} />
            確認 Zoom 預約
          </button>
        </section>

        <section className="zoom-calendar-panel">
          <div className="focus-panel-head">
            <div>
              <span className="section-kicker">Calendar fallback</span>
              <h3>或手動選擇時段</h3>
            </div>
            <span className="window-badge">美東</span>
          </div>
          <div className="compact-date-row">
            {previewDays.map((day) => (
              <button className={props.activeDayId === day.id ? "active" : ""} key={day.id} type="button" onClick={() => props.setActiveDayId(day.id)}>
                <span>{day.weekday}</span>
                <strong>{day.date}</strong>
              </button>
            ))}
          </div>
          <div className="focus-slot-grid compact-slots">
            {props.activeDay.slots.map((slot) => (
              <SlotPreviewButton key={slot.id} selected={props.selectedSlotIds.includes(slot.id)} slot={slot} onClick={() => props.toggleSlot(slot)} />
            ))}
          </div>
          <SelectedPreviewSummary selectedSlots={props.selectedSlots} />
        </section>
      </div>
    </div>
  );
}

function SlotPreviewButton(props: { selected: boolean; slot: PreviewSlot; onClick: () => void }) {
  const blocked = props.slot.status === "blocked";
  return (
    <button
      aria-pressed={props.selected}
      className={`preview-slot-button ${props.selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
      disabled={blocked}
      type="button"
      onClick={props.onClick}
    >
      <Clock size={15} />
      <span>
        {props.slot.time}
        {blocked ? <small>已預約</small> : null}
      </span>
    </button>
  );
}

function SelectedPreviewSummary({ selectedSlots }: { selectedSlots: Array<PreviewSlot & { day: PreviewDay }> }) {
  return (
    <div className="selected-preview-summary">
      <div className="selected-summary-head">
        <span>已選時段</span>
        <strong>{selectedSlots.length} 個</strong>
      </div>
      {selectedSlots.length ? (
        <div className="selected-preview-list">
          {selectedSlots.map((slot) => (
            <div key={slot.id}>
              <FileText size={15} />
              <span>
                {slot.day.weekday} {slot.day.date} · {slot.time}
              </span>
              <X size={14} />
            </div>
          ))}
        </div>
      ) : (
        <p>還沒有選擇時段。</p>
      )}
    </div>
  );
}
