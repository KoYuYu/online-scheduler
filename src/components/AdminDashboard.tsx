"use client";

import {
  CalendarDays,
  Clock,
  ClipboardPaste,
  FileText,
  Link,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import type { AvailabilityRule, Booking, ParsedZoomInvite } from "@/lib/types";

const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const availabilityWindow = "週一至週五 晚上 8:00 到凌晨 12:00（美東）；週六、週日 早上 10:00 到下午 1:00、晚上 7:00 到凌晨 12:00（美東）";
const startTimeOptions = [
  { value: "10:00", label: "早上 10:00" },
  { value: "13:00", label: "下午 1:00" },
  { value: "19:00", label: "晚上 7:00" },
  { value: "20:00", label: "晚上 8:00" },
  { value: "21:00", label: "晚上 9:00" },
  { value: "22:00", label: "晚上 10:00" },
  { value: "23:00", label: "晚上 11:00" },
];
const endTimeOptions = [
  { value: "13:00", label: "下午 1:00" },
  { value: "19:00", label: "晚上 7:00" },
  { value: "21:00", label: "晚上 9:00" },
  { value: "22:00", label: "晚上 10:00" },
  { value: "23:00", label: "晚上 11:00" },
  { value: "24:00", label: "凌晨 12:00" },
];

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [zoomText, setZoomText] = useState("");
  const [zoomPreview, setZoomPreview] = useState<ParsedZoomInvite | null>(null);
  const [adminName, setAdminName] = useState("");
  const [newRule, setNewRule] = useState({ weekday: 1, startTimeLocal: "20:00", endTimeLocal: "24:00" });

  async function loadSession() {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    setAuthenticated(response.ok);
    if (response.ok) {
      await loadCalendar();
    }
  }

  async function loadCalendar() {
    const response = await fetch("/api/admin/calendar", { cache: "no-store" });
    if (!response.ok) {
      setAuthenticated(false);
      return;
    }
    const data = (await response.json()) as { bookings: Booking[]; rules: AvailabilityRule[] };
    setBookings(data.bookings || []);
    setRules(data.rules || []);
  }

  useEffect(() => {
    void loadSession();
  }, []);

  async function login() {
    setMessage(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setMessage("登入失敗。");
      return;
    }
    setAuthenticated(true);
    await loadCalendar();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/");
  }

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void login();
  }

  function handleLoginKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void login();
  }

  async function parseZoom() {
    setMessage(null);
    setZoomPreview(null);
    const response = await fetch("/api/zoom-invites/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: zoomText }),
    });
    const data = (await response.json()) as { preview?: ParsedZoomInvite; error?: string };
    if (!response.ok || !data.preview) {
      setMessage(data.error || "無法解析 Zoom 邀請。");
      return;
    }
    setZoomPreview(data.preview);
    setAdminName(data.preview.title);
  }

  async function importZoom() {
    if (!zoomPreview) {
      return;
    }
    const response = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "admin_zoom",
        title: zoomPreview.title,
        startAtUtc: zoomPreview.startAtUtc,
        endAtUtc: zoomPreview.endAtUtc,
        bookerName: adminName || zoomPreview.title,
        bookerEmail: null,
        invitedByName: zoomPreview.invitedByName,
        zoomJoinUrl: zoomPreview.zoomJoinUrl,
        meetingId: zoomPreview.meetingId,
        passcode: zoomPreview.passcode,
        rawInviteText: zoomText,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "匯入失敗。");
      return;
    }
    setZoomPreview(null);
    setZoomText("");
    setAdminName("");
    setMessage("Zoom 預約已匯入。");
    await loadCalendar();
  }

  async function deleteBooking(id: string) {
    await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    await loadCalendar();
  }

  async function createRule() {
    setMessage(null);
    if (minutesFromTime(newRule.endTimeLocal) <= minutesFromTime(newRule.startTimeLocal)) {
      setMessage("結束時間必須晚於開始時間。");
      return;
    }

    const response = await fetch("/api/admin/availability-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newRule, slotMinutes: 60, timezone: "America/New_York", isActive: true }),
    });
    if (!response.ok) {
      setMessage("無法新增可預約規則。");
      return;
    }
    await loadCalendar();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/admin/availability-rules/${id}`, { method: "DELETE" });
    await loadCalendar();
  }

  if (authenticated === null) {
    return (
      <main className="app-shell">
        <div className="empty-state">正在載入管理後台</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="login-card panel">
        <div className="panel-header">
          <div className="brand">
            <div className="brand-mark">
              <CalendarDays size={22} />
            </div>
            <div>
              <h1>預約管理後台</h1>
              <p>本機無 DATABASE_URL 時預設：admin@example.com / password123</p>
            </div>
          </div>
        </div>
        <form className="panel-body form-stack" onSubmit={handleLoginSubmit}>
          <label className="field">
            <span>電子信箱</span>
            <input
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleLoginKeyDown}
            />
          </label>
          <label className="field">
            <span>密碼</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handleLoginKeyDown}
            />
          </label>
          <button className="primary-button" type="submit">
            <LogIn size={17} />
            登入
          </button>
          {message ? <div className="message error">{message}</div> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell admin-shell">
      <div className="topbar compact">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={22} />
          </div>
          <div>
            <h1>預約管理後台</h1>
            <p>{availabilityWindow}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button compact-button" type="button" onClick={() => void loadCalendar()}>
            <RefreshCw size={16} />
            重新整理
          </button>
          <button className="ghost-button compact-button" type="button" onClick={() => void logout()}>
            <LogOut size={16} />
            登出
          </button>
        </div>
      </div>

      <section className="admin-grid">
        <section className="surface bookings-surface" aria-labelledby="admin-calendar-heading">
          <div className="surface-header">
            <div>
              <span className="section-kicker">營運行事曆</span>
              <h2 id="admin-calendar-heading">預約列表</h2>
              <p className="muted">已確認的會議、匯入的 Zoom 連結與手動預約。</p>
            </div>
            <span className="pill">{bookings.length} 筆預約</span>
          </div>
          <div className="booking-list">
            {bookings.length ? (
              bookings.map((booking) => (
                <article className="booking-card" key={booking.id}>
                  <header>
                    <div className="booking-main">
                      <h3>{booking.title}</h3>
                      <div className="booking-time">
                        <Clock size={15} />
                        <span>{formatBookingWindow(booking)}</span>
                      </div>
                    </div>
                    <button className="icon-button" title="刪除預約" type="button" onClick={() => void deleteBooking(booking.id)}>
                      <Trash2 size={16} />
                    </button>
                  </header>
                  <div className="booking-meta">
                    <span>{booking.bookerName || "未提供姓名"}</span>
                    {booking.invitedByName ? <span>邀請人：{booking.invitedByName}</span> : null}
                    <span>{formatSourceLabel(booking.source)}</span>
                  </div>
                  {booking.zoomJoinUrl ? (
                    <p className="muted link-line">
                      <Link size={14} />
                      <a href={booking.zoomJoinUrl} rel="noreferrer" target="_blank">Zoom 連結</a>
                      {booking.meetingId ? <span>{booking.meetingId}</span> : null}
                      {booking.passcode ? <span>{booking.passcode}</span> : null}
                    </p>
                  ) : null}
                  {booking.attachmentDataBase64 && booking.attachmentFileName ? (
                    <p className="muted link-line">
                      <FileText size={14} />
                      <a href={buildPdfDataUrl(booking)} download={booking.attachmentFileName}>下載 PDF：{booking.attachmentFileName}</a>
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="empty-state">目前沒有預約</div>
            )}
          </div>
        </section>

        <aside className="admin-side">
          <section className="surface" aria-labelledby="zoom-import-heading">
            <div className="surface-header slim">
              <div>
                <span className="section-kicker">匯入</span>
                <h2 id="zoom-import-heading">Zoom 邀請</h2>
              </div>
              <ClipboardPaste size={18} className="muted-icon" />
            </div>
            <div className="form-stack">
              <label className="field">
                <span>邀請內容</span>
                <textarea value={zoomText} onChange={(event) => setZoomText(event.target.value)} />
              </label>
              <button className="ghost-button" disabled={!zoomText.trim()} type="button" onClick={() => void parseZoom()}>
                <ClipboardPaste size={17} />
                解析邀請
              </button>
              {zoomPreview ? <AdminZoomPreview preview={zoomPreview} /> : null}
              <label className="field">
                <span>姓名</span>
                <input value={adminName} onChange={(event) => setAdminName(event.target.value)} />
              </label>
              <button className="primary-button" disabled={!zoomPreview} type="button" onClick={() => void importZoom()}>
                <Save size={17} />
                確認匯入
              </button>
            </div>
          </section>

          <section className="surface" aria-labelledby="availability-heading">
            <div className="surface-header slim">
              <div>
                <span className="section-kicker">規則</span>
                <h2 id="availability-heading">可預約時間</h2>
                <p className="muted">週末早上可設定 10:00 到 13:00；晚上時段可一路設定到凌晨 12:00。</p>
              </div>
            </div>
            <div className="form-stack">
              <div className="form-grid availability-form">
                <label className="field">
                  <span>星期</span>
                  <select value={newRule.weekday} onChange={(event) => setNewRule({ ...newRule, weekday: Number(event.target.value) })}>
                    {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>開始</span>
                  <select value={newRule.startTimeLocal} onChange={(event) => setNewRule({ ...newRule, startTimeLocal: event.target.value })}>
                    {startTimeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>結束</span>
                  <select value={newRule.endTimeLocal} onChange={(event) => setNewRule({ ...newRule, endTimeLocal: event.target.value })}>
                    {endTimeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <button className="primary-button" type="button" onClick={() => void createRule()}>
                  <Plus size={17} />
                  新增規則
                </button>
              </div>
              <div className="rule-list">
                {rules.map((rule) => (
                  <div className="rule-card" key={rule.id}>
                    <span>
                      <strong>{weekdays[rule.weekday]}</strong>
                      {formatRuleTime(rule.startTimeLocal)}-{formatRuleTime(rule.endTimeLocal)}
                    </span>
                    <button className="icon-button" title="刪除規則" type="button" onClick={() => void deleteRule(rule.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          {message ? <div className="message">{message}</div> : null}
        </aside>
      </section>
    </main>
  );
}

function AdminZoomPreview({ preview }: { preview: ParsedZoomInvite }) {
  return (
    <div className="preview-card">
      <div className="preview-row"><span>邀請人</span><strong>{preview.invitedByName || "未提供"}</strong></div>
      <div className="preview-row"><span>主題</span><strong>{preview.title}</strong></div>
      <div className="preview-row"><span>美東時間</span><strong>{formatBookingWindow(preview)}</strong></div>
      <div className="preview-row">
        <span>Zoom 連結</span>
        <a href={preview.zoomJoinUrl || "#"} rel="noreferrer" target="_blank">{preview.zoomJoinUrl || "未找到連結"}</a>
      </div>
    </div>
  );
}

function formatBookingWindow(booking: Pick<Booking, "startAtUtc" | "endAtUtc">): string {
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endFormatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(booking.startAtUtc))} - ${endFormatter.format(new Date(booking.endAtUtc))}（美東）`;
}

function formatSourceLabel(source: Booking["source"]): string {
  const labels: Record<Booking["source"], string> = {
    manual: "手動預約",
    zoom: "Zoom 預約",
    admin: "管理員新增",
    admin_zoom: "管理員匯入 Zoom",
  };
  return labels[source] || source;
}

function buildPdfDataUrl(booking: Booking): string {
  return `data:${booking.attachmentMimeType || "application/pdf"};base64,${booking.attachmentDataBase64 || ""}`;
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatRuleTime(value: string): string {
  if (value === "24:00") {
    return "凌晨 12:00";
  }
  const [hour, minute] = value.split(":").map(Number);
  const period = hour < 6 ? "凌晨" : hour < 12 ? "早上" : hour < 18 ? "下午" : "晚上";
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}
