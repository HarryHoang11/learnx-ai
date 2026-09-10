// ================================================================
// TRANG LỊCH HỌC (Calendar) — Fixed date handling with LearningDay integration
// ================================================================
// Uses /api/calendar/month-grid for month view with proper date mapping
// All dates handled in local timezone (Vietnam) to prevent UTC shift
// ================================================================

"use client";

import { Fragment, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

type Tab = "today" | "week" | "month";

interface StudySessionDto {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  startTime: string;
  endTime: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

interface CalendarDayDto {
  date: string;
  isCurrentMonth: boolean;
  dateStr: string;
  isLearned: boolean;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
];

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [sessions, setSessions] = useState<StudySessionDto[] | null>(null);
  const [monthGrid, setMonthGrid] = useState<CalendarDayDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  async function load() {
    setSessions(null);
    setMonthGrid(null);
    setError(null);
    try {
      if (tab === "month") {
        const res = await fetch(`/api/calendar/month-grid?year=${currentMonth.year}&month=${currentMonth.month}`);
        const json: ApiResponse<CalendarDayDto[]> = await res.json();
        if (json.success) setMonthGrid(json.data);
        else setError(json.error);
      } else {
        const res = await fetch(`/api/calendar/${tab}`);
        const json: ApiResponse<StudySessionDto[]> = await res.json();
        if (json.success) setSessions(json.data);
        else setError(json.error);
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    }
  }

  async function navigateMonth(delta: number) {
    let { year, month } = currentMonth;
    month += delta;
    if (month < 1) { month = 12; year--; }
    if (month > 12) { month = 1; year++; }
    const newMonth = { year, month };
    setCurrentMonth(newMonth);
    if (tab === "month") {
      await load();
    }
  }

  async function goToToday() {
    const now = new Date();
    const today = { year: now.getFullYear(), month: now.getMonth() + 1 };
    setCurrentMonth(today);
    if (tab === "month") {
      await load();
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentMonth.year, currentMonth.month]);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Lịch học</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Đóng" : "+ Thêm buổi học"}
          </button>
          {tab === "month" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="btn-secondary" onClick={() => navigateMonth(-1)} style={{ fontSize: 13, padding: "7px 12px" }}>
                ← Trước
              </button>
              <span style={{ fontWeight: 500, minWidth: 140, textAlign: "center" }}>
                {currentMonth.month}/{currentMonth.year}
              </span>
              <button className="btn-secondary" onClick={() => navigateMonth(1)} style={{ fontSize: 13, padding: "7px 12px" }}>
                Sau →
              </button>
              <button className="btn-secondary" onClick={goToToday} style={{ fontSize: 13, padding: "7px 12px" }}>
                Hôm nay
              </button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CreateSessionForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {tab !== "month" && (
        <div style={{ display: "flex", gap: 6, margin: "18px 0" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={tab === t.key ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 13 }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <StateMessage kind="error" text={error} />}
      {!error && sessions === null && monthGrid === null && <StateMessage kind="loading" text="Đang tải lịch..." />}

      {sessions && tab !== "month" && <SessionListView sessions={sessions} onChanged={load} />}
      {monthGrid && tab === "month" && <MonthCalendarView days={monthGrid} />}
    </section>
  );
}

// --- Danh sách buổi học (dùng cho tab Today & Week) ---
function SessionListView({ sessions, onChanged }: { sessions: StudySessionDto[]; onChanged: () => void }) {
  async function markCompleted(id: string) {
    await fetch(`/api/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", progress: 100 }),
    });
    onChanged();
  }

  async function remove(id: string) {
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    onChanged();
  }

  if (sessions.length === 0) {
    return (
      <Panel>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Không có buổi học nào trong khoảng thời gian này.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 4px",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {s.subject} — {s.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {new Date(s.startTime).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })} -{" "}
              {new Date(s.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {s.status}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {s.status !== "COMPLETED" && (
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => markCompleted(s.id)}>
                Đánh dấu xong
              </button>
            )}
            <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => remove(s.id)}>
              Xoá
            </button>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// --- Lịch tháng dạng lưới ngày (6 tuần x 7 ngày) với đánh dấu LearningDay ---
function MonthCalendarView({ days }: { days: CalendarDayDto[] }) {
  // Find today's date string for highlighting
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Panel>
      <div className="scroll-x-mobile">
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, 1fr)`, gap: 4, fontSize: 13, minWidth: 560 }}>
        {/* Weekday headers */}
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} style={{ textAlign: "center", color: "var(--text-dim)", fontWeight: 600, padding: "8px 0" }}>
            {d}
          </div>
        ))}
        {/* Days */}
        {days.map((day) => (
          <div
            key={day.dateStr}
            style={{
              aspectRatio: "1",
              minHeight: 70,
              borderRadius: 8,
              border: "1px solid var(--border-soft)",
              background: day.isCurrentMonth ? "var(--panel)" : "var(--bg)",
              color: day.isCurrentMonth ? "var(--text)" : "var(--text-faint)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Date number */}
            <div style={{ 
              padding: "6px 8px", 
              fontWeight: day.dateStr === todayStr ? 700 : 500,
              color: day.dateStr === todayStr ? "var(--cyan)" : "inherit",
              background: day.dateStr === todayStr ? "var(--cyan-soft)" : "transparent",
              borderRadius: "6px 6px 0 0",
            }}>
              {new Date(day.dateStr + 'T00:00:00').getDate()}
            </div>
            
            {/* Learning indicator */}
            {day.isLearned && day.isCurrentMonth && (
              <div style={{ 
                marginTop: "auto", 
                padding: "4px 8px 8px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}>
                <span style={{ 
                  fontSize: 10, 
                  background: "var(--cyan)", 
                  color: "#0a0e16",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}>
                  ✓ Đã học
                </span>
              </div>
            )}
            
            {/* Study sessions indicator (dots) */}
            {/* Could add session dots here if needed */}
          </div>
        ))}
      </div>
      </div>
    </Panel>
  );
}

// --- Form tạo buổi học mới ---
function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!date) {
      setError("Vui lòng chọn ngày.");
      setSubmitting(false);
      return;
    }

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, startTime: startISO, endTime: endISO }),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      setTitle("");
      setSubject("");
      onCreated();
    } catch {
      setError("Không thể tạo buổi học.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel style={{ marginBottom: 4 }}>
      <form onSubmit={handleSubmit} className="grid-form-2col">
        <input placeholder="Môn học (vd: Toán)" required value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        <input placeholder="Chủ đề (vd: Hàm số)" required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
          <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
        </div>
        {error && <p style={{ color: "var(--rose)", fontSize: 13, gridColumn: "1 / -1" }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ gridColumn: "1 / -1" }}>
          {submitting ? "Đang tạo..." : "Tạo buổi học"}
        </button>
      </form>
    </Panel>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 11px",
  color: "var(--text)",
  fontSize: 13.5,
  outline: "none",
  width: "100%",
};
