// ================================================================
// TRANG BẢNG XẾP HẠNG NGƯỜI ĐÓNG GÓP
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import ContributorLeaderboard from "@/components/community/ContributorLeaderboard";
import type { LeaderboardEntry } from "@/services/contribution.service";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<"weekly" | "monthly" | "alltime">("alltime");
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadSubjects();
    loadLeaderboard();
  }, []);

  async function loadSubjects() {
    try {
      const res = await fetch("/api/community/subjects");
      const json = await res.json();
      if (json.success) setSubjects(json.data);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }

  async function loadLeaderboard() {
    setLbLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (subjectId) params.set("subjectId", subjectId);
      params.set("limit", String(limit));

      const res = await fetch(`/api/community/leaderboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) setLeaderboard(json.data);
      else setError(json.error || "Không thể tải bảng xếp hạng");
    } catch (err) {
      setError("Không thể kết nối tới máy chủ");
    } finally {
      setLbLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [period, subjectId, limit]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  return (
    <section style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>🏆 Bảng xếp hạng Người đóng góp</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15 }}>Xếp hạng theo điểm đóng góp (CP) cho cộng đồng</p>
      </div>

      <Panel style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "monthly", "alltime"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: period === p ? "var(--indigo)" : "var(--panel-strong)",
                  color: period === p ? "#0a0e16" : "var(--text)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (period !== p) {
                    e.currentTarget.style.background = "var(--indigo-soft)";
                    e.currentTarget.style.borderColor = "var(--indigo)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (period !== p) {
                    e.currentTarget.style.background = "var(--panel-strong)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }
                }}
              >
                {["weekly", "monthly", "alltime"].indexOf(p) === 0 ? "📅" : ["monthly", "alltime"].indexOf(p) === 0 ? "📆" : "🏆"} {" "}
                {period === "weekly" ? "Tuần này" : period === "monthly" ? "Tháng này" : "Tất cả"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              value={subjectId || ""}
              onChange={(e) => setSubjectId(e.target.value || undefined)}
              style={{
                padding: "8px 12px",
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
                minWidth: 200,
              }}
            >
              <option value="">Tất cả môn học</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
              }}
            >
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
          </div>
        </div>
      </Panel>

      {loading && <StateMessage kind="loading" text="Đang tải bảng xếp hạng..." />}
      {error && <StateMessage kind="error" text={error} />}

      {!loading && !error && (
        <ContributorLeaderboard
          leaderboard={leaderboard}
          period={period}
          onPeriodChange={setPeriod}
          loading={lbLoading}
        />
      )}
    </section>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}