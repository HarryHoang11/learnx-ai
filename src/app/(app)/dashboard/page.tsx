// ================================================================
// TRANG CHỦ (Home) — Enhanced with XP/LXP/Level/Streak
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import StateMessage from "@/components/ui/StateMessage";
import TodaySchedule from "@/components/calendar/TodaySchedule";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

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

export default function HomePage() {
  const router = useRouter();
  const [askValue, setAskValue] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [xpData, setXpData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .then((json: ApiResponse<ProgressResponse>) => {
        if (json.success) setXpData(json.data);
      });
  }, []);

  function goToTutor() {
    const q = askValue.trim();
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  const weakest = progress?.skillMap
    .filter((s) => s.isWeak)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  return (
    <section>
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
          <span style={{ opacity: 0.5 }}>✺</span>
          <input
            value={askValue}
            onChange={(e) => setAskValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goToTutor()}
            placeholder="Hỏi LearnX AI, ví dụ: giải thích quy hoạch động..."
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

      {loading && <StateMessage kind="loading" text="Đang tải dữ liệu học tập..." />}
      {error && <StateMessage kind="error" text={error} />}

      {progress && xpData && (
        <>
          {/* XP / Level / LXP Stats */}
          <div className="grid-stats" style={{ marginBottom: 20 }}>
            <StatCard 
              value={`Level ${xpData.level}`} 
              label={`XP: ${formatNumber(xpData.lifetimeXP)}`} 
            />
            <StatCard 
              value={`${xpData.levelProgress.percent}%`} 
              label={`Tới Level ${xpData.level + 1}`} 
            />
            <StatCard 
              value={`${formatNumber(xpData.lxpBalance)} LXP`} 
              label="LearnX Points" 
            />
            <StatCard value={`🔥 ${xpData.streak.current}`} label={`${xpData.streak.longest} ngày dài nhất`} />
          </div>

          {/* XP Progress Bar */}
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

          <div style={{ marginBottom: 28 }}>
            <TodaySchedule />
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
            <Panel style={{ marginTop: 20 }}>
              <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
                Bạn chưa có dữ liệu năng lực nào — hãy làm bài{" "}
                <a href="/diagnostic" style={{ color: "var(--cyan)" }}>
                  Kiểm tra năng lực
                </a>{" "}
                trước để LearnX hiểu bạn đang mạnh/yếu ở đâu.
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  );
}