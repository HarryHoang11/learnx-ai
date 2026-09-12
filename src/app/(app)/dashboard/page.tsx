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
import { getLevelProgressDetails } from "@/lib/constants/xp";
import { useCountUp } from "@/lib/hooks/useCountUp";
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

// Nhãn tiếng Việt cho reason của XP transaction (fallback: prettify).
const REASON_LABELS: Record<string, string> = {
  lesson_complete: "Hoàn thành bài học",
  exercise_easy: "Giải bài tập dễ",
  exercise_medium: "Giải bài tập trung bình",
  exercise_hard: "Giải bài tập khó",
  quiz_complete: "Hoàn thành quiz",
  quiz_80_percent: "Quiz đạt ≥ 80%",
  daily_challenge: "Thử thách ngày",
  daily_mission: "Nhiệm vụ ngày",
  weekly_mission: "Nhiệm vụ tuần",
  mastery_milestone: "Cột mốc thành thạo",
  achievement_unlocked: "Mở khóa thành tựu",
  tutor_session_completed: "Buổi học với AI Gia sư",
  mindmap_created: "Tạo mind map",
  document_analyzed: "Phân tích tài liệu",
  reflection_completed: "Viết phản chiếu",
  task_completed: "Hoàn thành task",
  diagnostic_completed: "Hoàn thành kiểm tra năng lực",
  roadmap_completed: "Hoàn thành lộ trình",
  review_completed: "Ôn tập",
  study_session_completed: "Hoàn thành buổi học",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export default function HomePage() {
  const router = useRouter();
  const [askValue, setAskValue] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [xpData, setXpData] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDue, setReviewDue] = useState<ReviewDueResponse | null>(null);
  const [recentXP, setRecentXP] = useState<XPHistoryItem[]>([]);
  const [goals, setGoals] = useState<GoalWithRoadmap[] | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));

    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<StreakResponse>) => {
        if (json.success) setXpData(json.data);
      });

    fetch("/api/review/due?limit=5")
      .then((res) => res.json())
      .then((json: ApiResponse<ReviewDueResponse>) => {
        if (json.success) setReviewDue(json.data);
      })
      .catch(() => {});

    fetch("/api/xp/history?page=1&limit=5")
      .then((res) => res.json())
      .then((json: ApiResponse<{ transactions: XPHistoryItem[] }>) => {
        if (json.success) setRecentXP(json.data.transactions);
      })
      .catch(() => {});

    fetch("/api/roadmaps")
      .then((res) => res.json())
      .then((json: ApiResponse<GoalWithRoadmap[]>) => {
        if (json.success) setGoals(json.data);
      })
      .catch(() => {});
  }, []);

  function goToTutor() {
    const q = askValue.trim();
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  const weakest = progress?.skillMap
    .filter((s) => s.isWeak)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  const formatNumber = (num: number) => num.toLocaleString("vi-VN");

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
        <h1 style={{ fontSize: 27, fontWeight: 600 }}>Chào buổi tối 👋</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginTop: 6 }}>
          Hôm nay bạn muốn học gì tiếp theo?
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
            placeholder="Hỏi LearnX AI, ví dụ: giải thích quy hoạch động..."
            aria-label="Hỏi LearnX AI"
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
            Hỏi
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

      {progress && xp && streak && (
        <>
          {/* XP / Level / LXP Stats */}
          <div className="grid-stats enter enter--1" style={{ marginBottom: 20 }}>
            <StatCard
              value={`Level ${levelDetails?.level ?? xp.level}`}
              label={`XP: ${formatNumber(animatedXP)}`}
            />
            <StatCard
              value={`${levelDetails?.progressPercent ?? xp.levelProgress.percent}%`}
              label={`Tới Level ${(levelDetails?.level ?? xp.level) + 1}`}
            />
            <StatCard
              value={`${formatNumber(xp.lxpBalance)} LXP`}
              label="LearnX Points"
            />
            <StatCard value={`🔥 ${streak.current}`} label={`${streak.longest} ngày dài nhất`} />
          </div>

          {/* XP Progress Bar — dùng component chung, cùng 1 công thức */}
          <LevelProgressBar lifetimeXP={xp.lifetimeXP} />

          {/* Hôm nay: lịch học + ôn tập đến hạn + học tiếp */}
          <div className="grid-progress enter enter--2" style={{ marginBottom: 20 }}>
            <div>
              <TodaySchedule />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📚 Ôn tập đến hạn</div>
                {reviewDue ? (
                  reviewDue.stats.due > 0 ? (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                      <span style={{ color: "var(--amber)", fontWeight: 700 }}>{reviewDue.stats.due}</span>{" "}
                      chủ đề cần ôn hôm nay
                      {reviewDue.stats.overdue > 0 && (
                        <> (quá hạn {reviewDue.stats.overdue})</>
                      )}
                      <ul style={{ margin: "8px 0 12px", paddingLeft: 18 }}>
                        {reviewDue.reviews.slice(0, 3).map((r) => (
                          <li key={r.id}>
                            {r.subject ? `${r.subject} · ` : ""}{r.topic}
                          </li>
                        ))}
                      </ul>
                      <button className="btn-secondary" onClick={() => router.push("/practice")} style={{ fontSize: 12.5 }}>
                        Luyện tập ngay
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                      Hôm nay không có gì đến hạn ôn. 🎉
                    </div>
                  )
                ) : (
                  <Skeleton height={40} />
                )}
              </Panel>

              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>▶ Học tiếp</div>
                {goals === null ? (
                  <Skeleton height={40} />
                ) : continueGoal ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{continueGoal.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0 10px" }}>
                      Tiến độ {continueGoal.progressPercent}%
                    </div>
                    <div className="bar-track" style={{ marginBottom: 12 }}>
                      <div className="bar-fill" style={{ width: `${continueGoal.progressPercent}%` }} />
                    </div>
                    <button className="btn-primary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                      Tiếp tục lộ trình
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    Chưa có lộ trình nào đang học.
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-secondary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                        Tạo lộ trình
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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🧠 Tổng quan năng lực</div>
              {(progress.skillMap.length === 0) ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  Chưa có dữ liệu — làm bài{" "}
                  <a href="/diagnostic" style={{ color: "var(--cyan)" }}>Kiểm tra năng lực</a>{" "}
                  để LearnX vẽ bản đồ năng lực của bạn.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--cyan-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cyan)" }}>{mastered}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Vững</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--indigo-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--indigo)" }}>{learningCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Đang học</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--amber-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{weakCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Cần củng cố</div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🕘 Hoạt động gần đây</div>
              {recentXP.length === 0 ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                  Chưa có hoạt động nào — hoàn thành bài đầu tiên để bắt đầu.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentXP.map((t) => (
                    <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{reasonLabel(t.reason)}</span>
                      <span style={{ color: "var(--cyan)", fontWeight: 600, whiteSpace: "nowrap" }}>+{t.amount} XP</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {weakest ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, margin: "30px 0 14px" }}>LearnX đề xuất</div>
              <Panel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    Ôn lại {weakest.subject} — {weakest.topic}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                    Bạn đang ở mức {weakest.masteryPercent}% chủ đề này — nên ôn trước khi sang bài mới
                  </div>
                </div>
                <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                  Xem lộ trình
                </button>
              </Panel>
            </>
          ) : (
            <EmptyState
              icon="🧭"
              title="Chưa có dữ liệu năng lực"
              description="Làm bài Kiểm tra năng lực trước để LearnX hiểu bạn đang mạnh/yếu ở đâu."
              actionLabel="Kiểm tra năng lực"
              onAction={() => router.push("/diagnostic")}
            />
          )}
        </>
      )}
    </section>
  );
}
