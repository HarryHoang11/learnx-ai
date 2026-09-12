// ================================================================
// TRANG CHỦ (Home) — trung tâm học tập: hôm nay + skills + activity
// ================================================================
// Mạch tư duy: dashboard không chỉ là statistic — nó trả lời 4 câu
// hỏi của học sinh: "Hôm nay học gì?" (lịch + ôn tập đến hạn),
// "Mình đang ở đâu?" (skill overview), "Vừa qua mình đã làm gì?"
// (recent XP activity), "Học tiếp ở đâu?" (continue roadmap).
// Mọi số liệu đọc từ API thật, không hardcode.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import StateMessage from "@/components/ui/StateMessage";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import TodaySchedule from "@/components/calendar/TodaySchedule";
import NextActionModule from "@/components/dashboard/NextActionModule";
import { getLevelProgressDetails } from "@/lib/constants/xp";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { hasKey, localeFor, type I18nKey } from "@/lib/i18n/dictionary";
import type { ApiResponse, GoalWithRoadmap, SkillMasteryPoint } from "@/types";

interface ProgressData {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

interface ProgressResponse {
  lifetimeXP: number;
  lifetimeLXP: number;
  lxpBalance: number;
  level: number;
  levelProgress: { current: number; next: number; percent: number; level: number };
  streak: { current: number; longest: number; lastLearningDay: string | null };
}

interface StreakResponse {
  streak: { current: number; longest: number; lastLearningDay: string | null };
  progress: ProgressResponse | null;
}

interface XPHistoryItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface ReviewDueResponse {
  reviews: { id: string; topic: string; subject?: string | null }[];
  stats: { due: number; overdue: number; upcoming: number; total: number };
}

// Nhãn XP reason theo ngôn ngữ UI — key `xp.reason.*` trong dictionary,
// reason lạ fallback prettify (không crash khi backend thêm type mới).
function reasonLabel(t: (key: I18nKey) => string, reason: string): string {
  const key = `xp.reason.${reason}`;
  return hasKey(key) ? t(key) : reason.replace(/_/g, " ");
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [askValue, setAskValue] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [xpData, setXpData] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDue, setReviewDue] = useState<ReviewDueResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [recentXP, setRecentXP] = useState<XPHistoryItem[] | null>(null);
  const [goals, setGoals] = useState<GoalWithRoadmap[] | null>(null);
  const [streakError, setStreakError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));

    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<StreakResponse>) => {
        if (json.success) setXpData(json.data);
        else setStreakError(json.error);
      })
      .catch(() => setStreakError(t("common.connectionError")));

    fetch("/api/review/due?limit=5")
      .then((res) => res.json())
      .then((json: ApiResponse<ReviewDueResponse>) => {
        if (json.success) setReviewDue(json.data);
        else setReviewDue(null);
      })
      .catch(() => setReviewDue(null))
      .finally(() => setReviewLoading(false));

    fetch("/api/xp/history?page=1&limit=5")
      .then((res) => res.json())
      .then((json: ApiResponse<{ transactions: XPHistoryItem[] }>) => {
        if (json.success) setRecentXP(json.data.transactions);
        else setRecentXP([]);
      })
      .catch(() => setRecentXP([]));

    fetch("/api/roadmaps")
      .then((res) => res.json())
      .then((json: ApiResponse<GoalWithRoadmap[]>) => {
        if (json.success) setGoals(json.data);
        else setGoals([]);
      })
      .catch(() => setGoals([]));
  }, []);

  function goToTutor() {
    const q = askValue.trim();
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  const weakest = progress?.skillMap
    .filter((s) => s.isWeak)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  const formatNumber = (num: number) => num.toLocaleString(localeFor(lang));

  // Lời chào theo giờ trình duyệt — tính SAU mount (useEffect) để SSR
  // và client render cùng fallback, tránh hydration mismatch khi giờ
  // server khác giờ trình duyệt (cùng class bug với calendar anchor).
  const [greetingKey, setGreetingKey] = useState<
    "dashboard.greeting.morning" | "dashboard.greeting.afternoon" | "dashboard.greeting.evening"
  >("dashboard.greeting.evening");
  useEffect(() => {
    const h = new Date().getHours();
    setGreetingKey(h < 11 ? "dashboard.greeting.morning" : h < 18 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening");
  }, []);

  const xp = xpData?.progress;
  const streak = xpData?.streak;
  // Single source: % hiển thị suy từ lifetimeXP, đồng nhất với
  // LevelProgressBar bên dưới (không dùng percent thô từ API).
  const levelDetails = xp ? getLevelProgressDetails(xp.lifetimeXP) : null;
  const animatedXP = useCountUp(xp?.lifetimeXP ?? 0);

  const mastered = progress?.skillMap.filter((s) => s.masteryPercent >= 80).length ?? 0;
  const weakCount = progress?.skillMap.filter((s) => s.isWeak).length ?? 0;
  const learningCount = Math.max(0, (progress?.skillMap.length ?? 0) - mastered - weakCount);
  const continueGoal = goals?.find((g) => g.status === "ACTIVE") ?? null;

  return (
    <section className="page-enter">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 27, fontWeight: 600 }}>{t(greetingKey)}</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginTop: 6 }}>
          {t("dashboard.subtitle")}
        </p>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--panel-strong)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "13px 16px",
          }}
        >
          <span style={{ opacity: 0.5 }} aria-hidden="true">✺</span>
          <input
            value={askValue}
            onChange={(e) => setAskValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goToTutor()}
            placeholder={t("dashboard.askPlaceholder")}
            aria-label={t("dashboard.askAria")}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 14.5,
            }}
          />
          <button className="btn-primary" onClick={goToTutor}>
            {t("common.ask")}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          <Skeleton height={96} radius={16} />
          <Skeleton height={120} radius={16} />
        </div>
      )}
      {error && <StateMessage kind="error" text={error} />}

      {progress && (
        <>
          {/* XP / Level / LXP Stats */}
          <div className="grid-stats enter enter--1" style={{ marginBottom: 20 }}>
            <StatCard
              value={t("common.level", { n: levelDetails?.level ?? 1 })}
              label={t("common.xpLabel", { n: formatNumber(animatedXP) })}
            />
            <StatCard
              value={`${levelDetails?.progressPercent ?? 0}%`}
              label={t("common.toLevel", { n: (levelDetails?.level ?? 1) + 1 })}
            />
            <StatCard
              value={`${formatNumber(xp?.lxpBalance ?? 0)} LXP`}
              label={t("dashboard.lxpLabel")}
            />
            <StatCard value={`🔥 ${streak?.current ?? 0}`} label={t("common.longestDays", { n: streak?.longest ?? 0 })} />
          </div>

          {/* XP Progress Bar — dùng component chung, cùng 1 công thức */}
          {xp !== null && (
            <LevelProgressBar lifetimeXP={xp?.lifetimeXP ?? 0} />
          )}
          {streakError && <StateMessage kind="error" text={streakError} />}

          {/* Hôm nay: lịch học + ôn tập đến hạn + học tiếp */}
          <div className="grid-progress enter enter--2" style={{ marginBottom: 20 }}>
            <div>
              <TodaySchedule />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("dashboard.reviewDue")}</div>
                {reviewDue ? (
                  reviewDue.stats.due > 0 ? (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                      <span style={{ color: "var(--amber)", fontWeight: 700 }}>{reviewDue.stats.due}</span>{" "}
                      {t("dashboard.reviewDueLine", { n: reviewDue.stats.due })}
                      {reviewDue.stats.overdue > 0 && (
                        <> {t("dashboard.reviewOverdue", { n: reviewDue.stats.overdue })}</>
                      )}
                      <ul style={{ margin: "8px 0 12px", paddingLeft: 18 }}>
                        {reviewDue.reviews.slice(0, 3).map((r) => (
                          <li key={r.id}>
                            {r.subject ? `${r.subject} · ` : ""}{r.topic}
                          </li>
                        ))}
                      </ul>
                      <button className="btn-secondary" onClick={() => router.push("/practice")} style={{ fontSize: 12.5 }}>
                        {t("common.practiceNow")}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                      {t("dashboard.reviewEmpty")}
                    </div>
                  )
                ) : reviewLoading ? (
                  <Skeleton height={40} />
                ) : (
                  <StateMessage kind="error" text={t("common.connectionError")} />
                )}
              </Panel>

              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("dashboard.continue")}</div>
                {goals === null ? (
                  <Skeleton height={40} />
                ) : continueGoal ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{continueGoal.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0 10px" }}>
                      {t("common.progressPercent", { n: continueGoal.progressPercent })}
                    </div>
                    <div className="bar-track" style={{ marginBottom: 12 }}>
                      <div className="bar-fill" style={{ width: `${continueGoal.progressPercent}%` }} />
                    </div>
                    <button className="btn-primary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                      {t("common.continueRoadmap")}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    {t("dashboard.noActiveGoal")}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-secondary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                        {t("common.createRoadmap")}
                      </button>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* Skill overview + Recent activity */}
          <div className="grid-progress enter enter--3" style={{ marginBottom: 20 }}>
            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("dashboard.skillOverview")}</div>
              {(progress.skillMap.length === 0) ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  {t("dashboard.skillEmptyA")}{" "}
                  <a href="/diagnostic" style={{ color: "var(--cyan)" }}>{t("common.assessment")}</a>{" "}
                  {t("dashboard.skillEmptyB")}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--cyan-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cyan)" }}>{mastered}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillMastered")}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--indigo-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--indigo)" }}>{learningCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillLearning")}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--amber-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{weakCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillWeak")}</div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("dashboard.recentActivity")}</div>
              {recentXP === null ? (
                <Skeleton height={40} />
              ) : recentXP.length === 0 ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                  {t("dashboard.activityEmpty")}
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentXP.map((tx) => (
                    <li key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{reasonLabel(t, tx.reason)}</span>
                      <span style={{ color: "var(--cyan)", fontWeight: 600, whiteSpace: "nowrap" }}>+{tx.amount} XP</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {weakest ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, margin: "30px 0 14px" }}>{t("dashboard.suggestTitle")}</div>
              <Panel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {t("dashboard.suggestLine", { subject: weakest.subject, topic: weakest.topic })}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                    {t("dashboard.suggestDetail", { n: weakest.masteryPercent })}
                  </div>
                </div>
                <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                  {t("common.viewRoadmap")}
                </button>
              </Panel>
            </>
          ) : (
            <EmptyState
              icon="🧭"
              title={t("dashboard.noSkillTitle")}
              description={t("dashboard.noSkillDesc")}
              actionLabel={t("common.assessment")}
              onAction={() => router.push("/diagnostic")}
            />
          )}

          <div className="enter enter--4" style={{ marginTop: 20 }}>
            <NextActionModule />
          </div>
        </>
      )}
    </section>
  );
}
