// ================================================================
// TRANG TIẾN ĐỘ (Progress) — Level Hero ở đầu, stats phía dưới
// ================================================================
// Hierarchy: Page title → LEVEL HERO → Stats → Skill Map / AI Insights.
// Số liệu Level/XP suy ra từ lifetimeXP bằng getLevelProgressDetails
// (single source of truth) — không render trực tiếp current/next thô
// từ API để không bao giờ hiển thị số âm hay bar full khi XP = 0.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import LevelHero from "@/components/ui/LevelHero";
import { getLevelProgressDetails } from "@/lib/constants/xp";
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

interface StreakResponse {
  streak: StreakData;
  progress: ProgressResponse;
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  const [xpData, setXpData] = useState<StreakResponse | null>(null);
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
      .then((json: ApiResponse<{ streak: StreakData; progress: ProgressResponse }>) => {
        if (json.success) setXpData(json.data);
      })
      .finally(() => setXpLoading(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text="Đang tải tiến độ..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!progress) return null;

  const formatNumber = (num: number) => num.toLocaleString("vi-VN");

  const xp = xpData?.progress;
  const streak = xpData?.streak;
  // Single source: mọi con số Level suy từ lifetimeXP, không dùng
  // current/next thô từ API (chống drift khi API/backend cũ còn sót).
  const levelDetails = xp ? getLevelProgressDetails(xp.lifetimeXP) : null;
  const hasLearningData = progress.totalAttempts > 0;

  return (
    <section className="page-enter">
      <h2 className="page-title">Tiến độ học tập</h2>

      {/* LEVEL HERO — vị trí nổi bật nhất, trên mọi stats */}
      {xpLoading ? (
        <Panel style={{ marginBottom: 24 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Đang tải cấp độ...</p>
        </Panel>
      ) : xp && levelDetails ? (
        <div className="enter enter--1">
          <LevelHero lifetimeXP={xp.lifetimeXP} />
        </div>
      ) : (
        <Panel style={{ marginBottom: 24 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            Chưa có dữ liệu cấp độ — hãy hoàn thành bài đầu tiên để bắt đầu tích XP.
          </p>
        </Panel>
      )}

      {/* Stats — secondary sau Level */}
      {xp && streak && (
        <div className="grid-stats enter enter--2" style={{ marginBottom: 24 }}>
          <StatCard
            value={`${formatNumber(xp.lxpBalance)} LXP`}
            label="LearnX Points"
          />
          <StatCard value={`🔥 ${streak.current}`} label={`${streak.longest} ngày dài nhất`} />
          <StatCard
            value={hasLearningData ? progress.totalAttempts : "—"}
            label={hasLearningData ? "Bài đã làm" : "Chưa làm bài nào"}
          />
          <StatCard
            value={hasLearningData ? `${progress.accuracyPercent}%` : "—"}
            label={hasLearningData ? "Độ chính xác" : "Làm bài để có thống kê"}
          />
          <StatCard value={progress.skillMap.length || "—"} label="Chủ đề đã theo dõi" />
          <StatCard value={formatNumber(xp.lifetimeXP)} label="Tổng XP" />
          <StatCard value={formatNumber(xp.lifetimeLXP)} label="Tổng LXP kiếm được" />
          <StatCard value={`${streak.longest} ngày`} label="Streak dài nhất" />
        </div>
      )}

      <div className="grid-progress enter enter--3" style={{ marginTop: 20 }}>
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
