// ================================================================
// TRANG TIẾN ĐỘ (Progress) — Enhanced with XP/LXP/Level/Streak
// ================================================================
// Uses new /api/streak endpoint for comprehensive progress data
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

interface ProgressData {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

interface StreakData {
  current: number;
  longest: number;
  lastLearningDay: string | null;
}

interface ProgressResponse {
  lifetimeXP: number;
  lifetimeLXP: number;
  lxpBalance: number;
  level: number;
  levelProgress: { current: number; next: number; percent: number; level: number };
  streak: StreakData;
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  const [xpData, setXpData] = useState<ProgressResponse | null>(null);
  const [xpLoading, setXpLoading] = useState(true);

  useEffect(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));

    fetch("/api/analytics")
      .then((res) => res.json())
      .then((json: ApiResponse<{ insight: string }>) => {
        if (json.success) setInsight(json.data.insight);
      })
      .finally(() => setInsightLoading(false));

    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressResponse>) => {
        if (json.success) setXpData(json.data);
      })
      .finally(() => setXpLoading(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text="Đang tải tiến độ..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!progress) return null;

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 18 }}>Tiến độ học tập</h2>

      {/* XP / Level / LXP Stats */}
      {xpData && (
        <div className="grid-stats" style={{ marginBottom: 24 }}>
          <StatCard 
            value={`Level ${xpData.level}`} 
            label={`XP: ${formatNumber(xpData.lifetimeXP)}`} 
          />
          <StatCard 
            value={`${xpData.levelProgress.percent}%`} 
            label={`Tới Level ${xpData.level + 1} (${formatNumber(xpData.levelProgress.next)} XP)`} 
          />
          <StatCard 
            value={`${formatNumber(xpData.lxpBalance)} LXP`} 
            label="LearnX Points" 
          />
          <StatCard value={`🔥 ${xpData.streak.current}`} label={`${xpData.streak.longest} ngày dài nhất`} />
        </div>
      )}

      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <StatCard value={progress.totalAttempts} label="Bài đã làm" />
        <StatCard value={`${progress.accuracyPercent}%`} label="Độ chính xác" />
        <StatCard value={progress.skillMap.length} label="Chủ đề đã theo dõi" />
        <StatCard value={xpData ? formatNumber(xpData.lifetimeLXP) : "—"} label="Tổng LXP kiếm được" />
      </div>

      {/* XP Progress Bar */}
      {xpData && (
        <Panel style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Level {xpData.level} → Level {xpData.level + 1}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              {formatNumber(xpData.levelProgress.current)} / {formatNumber(xpData.levelProgress.next)} XP
            </div>
          </div>
          <div className="bar-track" style={{ height: 12 }}>
            <div 
              className="bar-fill" 
              style={{ width: `${xpData.levelProgress.percent}%`, background: "linear-gradient(90deg, var(--cyan), var(--indigo))" }} 
            />
          </div>
        </Panel>
      )}

      <div className="grid-progress" style={{ marginTop: 20 }}>
        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Bản đồ năng lực</div>
          {progress.skillMap.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
              Chưa có dữ liệu — hãy làm bài Kiểm tra năng lực hoặc luyện tập để bắt đầu theo dõi.
            </p>
          ) : (
            progress.skillMap.map((s) => (
              <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
            ))
          )}
        </Panel>

        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Nhận xét từ AI</div>
          {insightLoading ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>AI đang phân tích 7 ngày gần đây...</p>
          ) : (
            <div
              style={{
                background: "var(--indigo-soft)",
                border: "1px solid rgba(124,108,240,0.3)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 13.5,
                color: "#d7d3fb",
              }}
            >
              {insight}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}