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
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";
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
  const { t, lang } = useLanguage();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightError, setInsightError] = useState<string | null>(null);

  const [xpData, setXpData] = useState<StreakResponse | null>(null);
  const [xpLoading, setXpLoading] = useState(true);
  const [xpError, setXpError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((json: ApiResponse<{ insight: string }>) => {
        if (json.success) setInsight(json.data.insight);
        else setInsightError(json.error);
      })
      .catch(() => setInsightError(t("common.connectionError")))
      .finally(() => setInsightLoading(false));

    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<{ streak: StreakData; progress: ProgressResponse }>) => {
        if (json.success) setXpData(json.data);
        else setXpError(json.error);
      })
      .catch(() => setXpError(t("common.connectionError")))
      .finally(() => setXpLoading(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text={t("progress.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!progress) return null;

  const formatNumber = (num: number) => num.toLocaleString(localeFor(lang));

  const xp = xpData?.progress;
  const streak = xpData?.streak;
  // Single source: mọi con số Level suy từ lifetimeXP, không dùng
  // current/next thô từ API (chống drift khi API/backend cũ còn sót).
  const levelDetails = xp ? getLevelProgressDetails(xp.lifetimeXP) : null;
  const hasLearningData = progress.totalAttempts > 0;

  return (
    <section className="page-enter">
      <h2 className="page-title">{t("progress.title")}</h2>

      {/* LEVEL HERO — vị trí nổi bật nhất, trên mọi stats */}
      {xpLoading ? (
        <Panel style={{ marginBottom: 24 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{t("progress.levelLoading")}</p>
        </Panel>
      ) : xp && levelDetails ? (
        <div className="enter enter--1">
          <LevelHero lifetimeXP={xp.lifetimeXP} />
        </div>
      ) : xpError ? (
        <Panel style={{ marginBottom: 24 }}>
          <StateMessage kind="error" text={xpError} />
        </Panel>
      ) : (
        <Panel style={{ marginBottom: 24 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            {t("progress.noLevel")}
          </p>
        </Panel>
      )}

      {/* Stats — secondary sau Level */}
      {xp && streak && (
        <div className="grid-stats enter enter--2" style={{ marginBottom: 24 }}>
          <StatCard
            value={`${formatNumber(xp.lxpBalance)} LXP`}
            label={t("progress.lxp")}
          />
          <StatCard value={`🔥 ${streak.current}`} label={t("common.longestDays", { n: streak.longest })} />
          <StatCard
            value={hasLearningData ? progress.totalAttempts : "—"}
            label={hasLearningData ? t("progress.doneCount") : t("progress.noAttempts")}
          />
          <StatCard
            value={hasLearningData ? `${progress.accuracyPercent}%` : "—"}
            label={hasLearningData ? t("progress.accuracy") : t("progress.noAccuracy")}
          />
          <StatCard value={progress.skillMap.length || "—"} label={t("progress.topics")} />
          <StatCard value={formatNumber(xp.lifetimeXP)} label={t("progress.totalXP")} />
          <StatCard value={formatNumber(xp.lifetimeLXP)} label={t("progress.totalLXP")} />
          <StatCard value={t("progress.days", { n: streak.longest })} label={t("progress.longestStreak")} />
        </div>
      )}

      <div className="grid-progress enter enter--3" style={{ marginTop: 20 }}>
        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("progress.skillMap")}</div>
          {progress.skillMap.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
              {t("progress.skillEmpty")}
            </p>
          ) : (
            progress.skillMap.map((s) => (
              <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
            ))
          )}
        </Panel>

        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("progress.aiTitle")}</div>
          {insightLoading ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{t("progress.aiLoading")}</p>
          ) : insightError ? (
            <StateMessage kind="error" text={insightError} />
          ) : (
            <div
              style={{
                background: "var(--indigo-soft)",
                border: "1px solid rgba(124,108,240,0.3)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 13.5,
                color: "var(--indigo-strong)",
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
