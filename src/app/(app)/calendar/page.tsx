// ================================================================
// TRANG LỊCH HỌC (Calendar)
// ================================================================
// Mạch tư duy: 3 tab (Today/Week/Month) gọi 3 API riêng biệt đã xây
// (GET /api/calendar/today|week|month) — KHÔNG gọi 1 API rồi tự lọc
// ở client, vì logic "thế nào là hôm nay/tuần này/tháng này" đã được
// chuẩn hoá ở backend (calendar.service.ts), tránh 2 nơi tính lệch
// nhau. Form tạo mới gọi POST /api/calendar, sau đó tự load lại tab
// đang xem để thấy ngay buổi học vừa tạo.
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

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
];

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [sessions, setSessions] = useState<StudySessionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setSessions(null);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${tab}`);
      const json: ApiResponse<StudySessionDto[]> = await res.json();
      if (json.success) setSessions(json.data);
      else setError(json.error);
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Lịch học</h2>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Đóng" : "+ Thêm buổi học"}
        </button>
      </div>

      {showForm && (
        <CreateSessionForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

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

      {error && <StateMessage kind="error" text={error} />}
      {!error && sessions === null && <StateMessage kind="loading" text="Đang tải lịch..." />}

      {sessions && tab !== "month" && <SessionListView sessions={sessions} onChanged={load} />}
      {sessions && tab === "month" && <MonthGridView sessions={sessions} />}
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

// --- Lưới theo tuần (môn học x thứ trong tuần), dùng khi tab = month ---
// Đơn giản hoá: nhóm theo môn học, đánh dấu ô nếu môn đó có buổi học
// rơi vào ngày tương ứng trong tuần đầu của dữ liệu tháng — đủ để
// nhìn tổng quan "môn nào học vào thứ mấy", không nhằm thay thế lịch
// đầy đủ dạng ô ngày-tháng chi tiết.
function MonthGridView({ sessions }: { sessions: StudySessionDto[] }) {
  const subjects = Array.from(new Set(sessions.map((s) => s.subject)));

  function hasSessionOnWeekday(subject: string, weekdayIndex: number): boolean {
    // weekdayIndex: 0 = T2 ... 6 = CN
    return sessions.some((s) => {
      if (s.subject !== subject) return false;
      const day = new Date(s.startTime).getDay(); // 0 = CN
      const normalized = day === 0 ? 6 : day - 1;
      return normalized === weekdayIndex;
    });
  }

  if (subjects.length === 0) {
    return (
      <Panel>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Chưa có buổi học nào trong tháng này.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="scroll-x-mobile">
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(7, 1fr)`, gap: 8, fontSize: 13, minWidth: 640 }}>
        <div />
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} style={{ textAlign: "center", color: "var(--text-dim)" }}>
            {d}
          </div>
        ))}
        {subjects.map((subject) => (
          <Fragment key={subject}>
            <div style={{ color: "var(--text)" }}>{subject}</div>
            {WEEKDAY_LABELS.map((_, idx) => (
              <div
                key={`${subject}-${idx}`}
                style={{
                  height: 24,
                  borderRadius: 6,
                  background: hasSessionOnWeekday(subject, idx) ? "var(--indigo-soft)" : "var(--panel-strong)",
                  border: hasSessionOnWeekday(subject, idx) ? "1px solid var(--indigo)" : "1px solid var(--border-soft)",
                }}
              />
            ))}
          </Fragment>
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
