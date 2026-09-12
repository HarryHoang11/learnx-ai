// ================================================================
// <TodaySchedule /> — lịch hôm nay + thanh tiến độ "X/Y nhiệm vụ"
// ================================================================
// Mạch tư duy: tách khỏi page vì được dùng ở CẢ Dashboard (rút gọn)
// lẫn trang Calendar (đầy đủ) — component tự fetch dữ liệu riêng
// (KHÔNG nhận props từ page cha) để mỗi nơi dùng nó độc lập, không
// phải page cha nào cũng phải tự gọi /api/calendar/today rồi truyền
// xuống.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";
import type { ApiResponse } from "@/types";

interface StudySessionDto {
  id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

const STATUS_ICON: Record<StudySessionDto["status"], string> = {
  COMPLETED: "✓",
  IN_PROGRESS: "◐",
  PENDING: "○",
};

function formatTime(locale: string, iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function TodaySchedule() {
  const { t, lang } = useLanguage();
  const locale = localeFor(lang);
  const [sessions, setSessions] = useState<StudySessionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar/today")
      .then((res) => res.json())
      .then((json: ApiResponse<StudySessionDto[]>) => {
        if (json.success) setSessions(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t("schedule.loadFail")));
  }, []);

  if (error) return <StateMessage kind="error" text={error} />;
  if (sessions === null) return <StateMessage kind="loading" text={t("schedule.loading")} />;

  const completed = sessions.filter((s) => s.status === "COMPLETED").length;
  const total = sessions.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Panel>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("schedule.today")}</div>
        <div className="bar-track" style={{ height: 10 }}>
          <div className="bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>
          {total === 0 ? t("schedule.empty") : t("schedule.progress", { done: completed, total, p: percent })}
        </div>
      </Panel>

      <Panel>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("schedule.title")}</div>
        {total === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            {t("schedule.emptyHint")}
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span
                style={{
                  color:
                    s.status === "COMPLETED" ? "var(--cyan)" : s.status === "IN_PROGRESS" ? "var(--indigo)" : "var(--text-faint)",
                  fontSize: 16,
                  width: 18,
                  textAlign: "center",
                }}
              >
                {STATUS_ICON[s.status]}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {s.subject} — {s.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {formatTime(locale, s.startTime)} - {formatTime(locale, s.endTime)}
                </div>
              </div>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
