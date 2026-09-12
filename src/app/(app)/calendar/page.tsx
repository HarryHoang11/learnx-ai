// ================================================================
// TRANG LỊCH HỌC (Calendar) — Month / Week / Day views
// ================================================================
// Mạch tư duy: 1 anchor ngày duy nhất (YYYY-MM-DD, local timezone)
// điều khiển cả 3 view — chuyển tab không mất vị trí đang xem.
// Dữ liệu sessions luôn từ DB (/api/calendar/*), KHÔNG hardcode.
// - Month: lưới 42 ô + dots số buổi học (từ month-grid.sessionCount)
// - Week: 7 cột T2–CN, sessions theo ngày (có prev/next tuần)
// - Day: timeline theo giờ, block dài theo thời lượng + vạch giờ hiện tại
// Click session -> SessionDetailModal (xem/sửa/reschedule/complete/xóa).

"use client";

import { Fragment, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

type View = "month" | "week" | "day";

interface StudySessionDto {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  topic: string | null;
  learningGoalId: string | null;
  startTime: string;
  endTime: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

interface CalendarDayDto {
  date: string;
  isCurrentMonth: boolean;
  dateStr: string;
  isLearned: boolean;
  sessionCount?: number;
}

interface GoalOption {
  id: string;
  title: string;
}

const VIEW_TABS: { key: View; label: string }[] = [
  { key: "month", label: "Tháng" },
  { key: "week", label: "Tuần" },
  { key: "day", label: "Ngày" },
];

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// --- Helpers ngày local (tránh UTC shift, đúng convention calendar.service) ---
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr: string, delta: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

function mondayOf(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const diff = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - diff);
  return toDateStr(d);
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export default function CalendarPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("week");
  // anchor = null cho tới khi mount ở client. KHÔNG khởi tạo bằng
  // new Date() trong useState: giá trị đó chạy cả ở server (SSR) lẫn
  // client, mà múi giờ server ≠ trình duyệt (vd server UTC, user +07)
  // là tiêu đề render khác nhau → hydration mismatch thật, mỗi sáng
  // 00:00–07:00 giờ VN. useEffect chỉ chạy ở client nên luôn đúng TZ.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudySessionDto[] | null>(null);
  const [monthGrid, setMonthGrid] = useState<CalendarDayDto[] | null>(null);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formPreset, setFormPreset] = useState<{ date?: string; startTime?: string; endTime?: string }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    if (anchor === null) return;
    setError(null);
    try {
      if (view === "month") {
        const y = parseDateStr(anchor).getFullYear();
        const m = parseDateStr(anchor).getMonth() + 1;
        const res = await fetch(`/api/calendar/month-grid?year=${y}&month=${m}`);
        const json: ApiResponse<CalendarDayDto[]> = await res.json();
        if (json.success) {
          setMonthGrid(json.data);
          setSessions(null);
        } else setError(json.error);
      } else if (view === "week") {
        const res = await fetch(`/api/calendar/week?start=${mondayOf(anchor)}`);
        const json: ApiResponse<StudySessionDto[]> = await res.json();
        if (json.success) {
          setSessions(json.data);
          setMonthGrid(null);
        } else setError(json.error);
      } else {
        const res = await fetch(`/api/calendar/day?date=${anchor}`);
        const json: ApiResponse<StudySessionDto[]> = await res.json();
        if (json.success) {
          setSessions(json.data);
          setMonthGrid(null);
        } else setError(json.error);
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    }
  }

  // Goals cho dropdown "gắn lộ trình" trong form tạo session.
  useEffect(() => {
    setAnchor((a) => a ?? toDateStr(new Date()));
    fetch("/api/roadmaps")
      .then((res) => res.json())
      .then((json: ApiResponse<GoalOption[]>) => {
        if (json.success) setGoals(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (anchor === null) return;
    setSessions(null);
    setMonthGrid(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor]);

  function shift(days: number) {
    setAnchor((a) => (a === null ? a : addDays(a, days)));
  }

  function goToToday() {
    setAnchor(toDateStr(new Date()));
  }

  function openDay(dateStr: string) {
    setAnchor(dateStr);
    setView("day");
  }

  function openCreatePreset(date: string, startTime?: string, endTime?: string) {
    setFormPreset({ date, startTime, endTime });
    setShowForm(true);
  }

  const selected = selectedId ? sessions?.find((s) => s.id === selectedId) ?? null : null;

  // Tiêu đề ổn định giữa SSR và client: khi anchor còn null (chưa
  // mount) thì hiện chữ tĩnh "Lịch học" ở cả hai phía — không bao giờ
  // render ngày tháng khác nhau giữa server/client.
  const title = (() => {
    if (anchor === null) return "Lịch học";
    const anchorDate = parseDateStr(anchor);
    if (view === "month") return `Tháng ${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`;
    if (view === "week") {
      const mon = mondayOf(anchor);
      return `Tuần ${mon.slice(8, 10)}/${mon.slice(5, 7)} – ${addDays(mon, 6).slice(8, 10)}/${addDays(mon, 6).slice(5, 7)}`;
    }
    return `Ngày ${anchorDate.getDate()}/${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`;
  })();

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 20 }}>Lịch học</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Đóng" : "+ Thêm buổi học"}
          </button>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn-secondary" onClick={() => shift(view === "month" ? -30 : view === "week" ? -7 : -1)} style={{ fontSize: 13, padding: "7px 12px" }}>
              ← Trước
            </button>
            <span style={{ fontWeight: 500, minWidth: 150, textAlign: "center", fontSize: 13.5 }}>{title}</span>
            <button className="btn-secondary" onClick={() => shift(view === "month" ? 30 : view === "week" ? 7 : 1)} style={{ fontSize: 13, padding: "7px 12px" }}>
              Sau →
            </button>
            <button className="btn-secondary" onClick={goToToday} style={{ fontSize: 13, padding: "7px 12px" }}>
              Hôm nay
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={view === t.key ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: 13 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <CreateSessionForm
          key={`${formPreset.date ?? ""}-${formPreset.startTime ?? ""}`}
          goals={goals}
          preset={formPreset}
          onCreated={() => {
            setShowForm(false);
            setFormPreset({});
            load();
          }}
        />
      )}

      {error && <StateMessage kind="error" text={error} />}
      {!error && sessions === null && monthGrid === null && (
        <StateMessage kind="loading" text="Đang tải lịch..." />
      )}

      {view === "month" && monthGrid && (
        <MonthCalendarView days={monthGrid} onOpenDay={openDay} />
      )}
      {view === "week" && sessions && anchor !== null && (
        <WeekView weekStart={mondayOf(anchor)} sessions={sessions} onSelect={setSelectedId} />
      )}
      {view === "day" && sessions && anchor !== null && (
        <DayView
          dateStr={anchor}
          sessions={sessions}
          onSelect={setSelectedId}
          onCreateSlot={(start, end) => openCreatePreset(anchor, start, end)}
        />
      )}

      {selected && (
        <SessionDetailModal
          session={selected}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            setSelectedId(null);
            load();
          }}
          onOpenDay={(dateStr) => {
            setSelectedId(null);
            openDay(dateStr);
          }}
        />
      )}
    </section>
  );
}

// --- Month view: lưới 42 ô + dots buổi học ---
function MonthCalendarView({ days, onOpenDay }: { days: CalendarDayDto[]; onOpenDay: (dateStr: string) => void }) {
  const todayStr = toDateStr(new Date());

  return (
    <Panel>
      <div className="scroll-x-mobile">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 13, minWidth: 560 }}>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} style={{ textAlign: "center", color: "var(--text-dim)", fontWeight: 600, padding: "8px 0" }}>
              {d}
            </div>
          ))}
          {days.map((day) => (
            <div
              key={day.dateStr}
              onClick={() => onOpenDay(day.dateStr)}
              style={{
                aspectRatio: "1",
                minHeight: 70,
                borderRadius: 8,
                border: day.dateStr === todayStr ? "1px solid var(--cyan)" : "1px solid var(--border-soft)",
                background: day.isCurrentMonth ? "var(--panel)" : "var(--bg)",
                color: day.isCurrentMonth ? "var(--text)" : "var(--text-faint)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  fontWeight: day.dateStr === todayStr ? 700 : 500,
                  color: day.dateStr === todayStr ? "var(--cyan)" : "inherit",
                  background: day.dateStr === todayStr ? "var(--cyan-soft)" : "transparent",
                  borderRadius: "6px 6px 0 0",
                }}
              >
                {parseDateStr(day.dateStr).getDate()}
              </div>
              <div style={{ marginTop: "auto", padding: "4px 8px 8px", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                {day.isLearned && day.isCurrentMonth && (
                  <span style={{ fontSize: 10, background: "var(--cyan)", color: "#0a0e16", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                    ✓
                  </span>
                )}
                {(day.sessionCount ?? 0) > 0 && (
                  <span style={{ display: "flex", gap: 3 }}>
                    {[0, 1, 2].slice(0, Math.min(3, day.sessionCount ?? 0)).map((i) => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--indigo)", display: "inline-block" }} />
                    ))}
                    {(day.sessionCount ?? 0) > 3 && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)" }}>+{day.sessionCount! - 3}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// --- Week view: 7 cột T2–CN ---
function WeekView({
  weekStart,
  sessions,
  onSelect,
}: {
  weekStart: string;
  sessions: StudySessionDto[];
  onSelect: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = toDateStr(new Date());

  return (
    <Panel>
      <div className="scroll-x-mobile">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(140px, 1fr))", gap: 8, minWidth: 700 }}>
          {days.map((d, i) => {
            const daySessions = sessions.filter((s) => toDateStr(new Date(s.startTime)) === d);
            const label = d === todayStr ? "Hôm nay" : WEEKDAY_LABELS[i];
            return (
              <div
                key={d}
                style={{
                  border: d === todayStr ? "1px solid var(--cyan)" : "1px solid var(--border-soft)",
                  borderRadius: 10,
                  padding: 8,
                  minHeight: 160,
                  background: d === todayStr ? "var(--cyan-soft)" : "var(--panel)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: d === todayStr ? "var(--cyan)" : "var(--text-dim)", marginBottom: 8 }}>
                  {label} · {d.slice(8, 10)}/{d.slice(5, 7)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {daySessions.length === 0 && (
                    <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>—</span>
                  )}
                  {daySessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s.id)}
                      className="btn-secondary"
                      style={{ fontSize: 12, textAlign: "left", padding: "8px 10px", borderLeft: `3px solid ${s.status === "COMPLETED" ? "var(--green)" : "var(--indigo)"}` }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
                        {new Date(s.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {new Date(s.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const PX_PER_HOUR = 56;

function DayView({
  dateStr,
  sessions,
  onSelect,
  onCreateSlot,
}: {
  dateStr: string;
  sessions: StudySessionDto[];
  onSelect: (id: string) => void;
  onCreateSlot: (start: string, end: string) => void;
}) {
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const isToday = dateStr === toDateStr(new Date());
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const daySessions = [...sessions].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  function fmt(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  return (
    <Panel>
      <div style={{ position: "relative", display: "flex" }}>
        <div style={{ width: 52, flexShrink: 0 }}>
          {hours.map((h) => (
            <div key={h} style={{ height: PX_PER_HOUR, fontSize: 11, color: "var(--text-faint)", textAlign: "right", paddingRight: 8 }}>
              {fmt(h * 60)}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          {hours.map((h) => (
            <div
              key={h}
              onClick={() => onCreateSlot(fmt(h * 60), fmt(Math.min(h * 60 + 60, (DAY_END_HOUR - 1) * 60 + 59)))}
              style={{ height: PX_PER_HOUR, borderTop: "1px solid var(--border-soft)", cursor: "pointer" }}
              title="Bấm để tạo buổi học giờ này"
            />
          ))}
          {isToday && nowMin >= DAY_START_HOUR * 60 && nowMin < DAY_END_HOUR * 60 && (
            <div
              style={{
                position: "absolute",
                top: ((nowMin - DAY_START_HOUR * 60) / 60) * PX_PER_HOUR,
                left: 0,
                right: 0,
                borderTop: "2px solid var(--rose)",
                pointerEvents: "none",
              }}
            />
          )}
          {daySessions.map((s) => {
            const startMin = Math.max(minutesOfDay(s.startTime), DAY_START_HOUR * 60);
            const endMin = Math.min(minutesOfDay(s.endTime), DAY_END_HOUR * 60);
            const top = ((startMin - DAY_START_HOUR * 60) / 60) * PX_PER_HOUR;
            const height = Math.max(28, ((endMin - startMin) / 60) * PX_PER_HOUR - 4);
            return (
              <button
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s.id);
                }}
                style={{
                  position: "absolute",
                  top,
                  left: 4,
                  right: 4,
                  height,
                  textAlign: "left",
                  borderRadius: 8,
                  border: "1px solid var(--indigo)",
                  background: s.status === "COMPLETED" ? "var(--panel-strong)" : "var(--indigo-soft)",
                  color: "var(--text)",
                  padding: "6px 10px",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.subject} — {s.title}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                  {new Date(s.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {new Date(s.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// --- Modal chi tiết session: xem / bắt đầu / xong / dời lịch / xóa ---
function SessionDetailModal({
  session,
  onClose,
  onChanged,
  onOpenDay,
}: {
  session: StudySessionDto;
  onClose: () => void;
  onChanged: () => void;
  onOpenDay: (dateStr: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState(() => toDateStr(new Date(session.startTime)));
  const [reschedStart, setReschedStart] = useState(() =>
    new Date(session.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [reschedEnd, setReschedEnd] = useState(() =>
    new Date(session.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })
  );

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) {
        setError(json.error);
        return false;
      }
      return true;
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{session.subject} — {session.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
              {new Date(session.startTime).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })} →{" "}
              {new Date(session.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {session.status === "COMPLETED" ? "Đã xong" : session.status === "IN_PROGRESS" ? "Đang học" : "Chờ học"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        {session.topic && <div style={{ fontSize: 13.5, marginBottom: 8 }}>Chủ đề: {session.topic}</div>}
        {session.description && (
          <div style={{ fontSize: 13.5, color: "var(--text-dim)", marginBottom: 8 }}>{session.description}</div>
        )}
        {session.learningGoalId && (
          <button className="btn-secondary" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={() => router.push("/roadmap")}>
            Thuộc lộ trình ↗
          </button>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {session.status !== "IN_PROGRESS" && session.status !== "COMPLETED" && (
            <button className="btn-primary" disabled={busy} onClick={async () => { if (await patch({ status: "IN_PROGRESS" })) onChanged(); }} style={{ fontSize: 13 }}>
              Bắt đầu học
            </button>
          )}
          {session.status !== "COMPLETED" && (
            <button className="btn-secondary" disabled={busy} onClick={async () => { if (await patch({ status: "COMPLETED", progress: 100 })) onChanged(); }} style={{ fontSize: 13 }}>
              Đánh dấu xong (+XP)
            </button>
          )}
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => onOpenDay(toDateStr(new Date(session.startTime)))}
            style={{ fontSize: 13 }}
          >
            Xem trong ngày
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            style={{ fontSize: 13, color: "var(--rose)" }}
            onClick={async () => {
              if (!confirm("Xoá buổi học này?")) return;
              setBusy(true);
              try {
                await fetch(`/api/calendar/${session.id}`, { method: "DELETE" });
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
          >
            Xoá
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Dời lịch</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} style={inputStyle} />
            <input type="time" value={reschedStart} onChange={(e) => setReschedStart(e.target.value)} style={inputStyle} />
            <input type="time" value={reschedEnd} onChange={(e) => setReschedEnd(e.target.value)} style={inputStyle} />
            <button
              className="btn-secondary"
              disabled={busy || !reschedDate}
              style={{ fontSize: 13 }}
              onClick={async () => {
                const ok = await patch({
                  startTime: new Date(`${reschedDate}T${reschedStart}:00`).toISOString(),
                  endTime: new Date(`${reschedDate}T${reschedEnd}:00`).toISOString(),
                });
                if (ok) onChanged();
              }}
            >
              Lưu lịch mới
            </button>
          </div>
        </div>

        {error && <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}

// --- Form tạo buổi học mới ---
function CreateSessionForm({
  onCreated,
  goals,
  preset,
}: {
  onCreated: () => void;
  goals: GoalOption[];
  preset: { date?: string; startTime?: string; endTime?: string };
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(preset.date ?? "");
  const [startTime, setStartTime] = useState(preset.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(preset.endTime ?? "09:00");
  const [description, setDescription] = useState("");
  const [learningGoalId, setLearningGoalId] = useState("");
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
        body: JSON.stringify({
          title,
          subject,
          startTime: startISO,
          endTime: endISO,
          description: description || undefined,
          learningGoalId: learningGoalId || undefined,
        }),
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
        <input placeholder="Mô tả (không bắt buộc)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
        <select value={learningGoalId} onChange={(e) => setLearningGoalId(e.target.value)} style={{ ...inputStyle, gridColumn: "1 / -1" }}>
          <option value="">Không gắn lộ trình (tùy chọn)</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
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
